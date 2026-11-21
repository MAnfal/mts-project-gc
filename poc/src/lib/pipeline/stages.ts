import pLimit from "p-limit";
import { z } from "zod";
import { gw } from "../gateway";
import { agencyNames, getDoc, getRawTextWithSource, listWindow } from "../fr";
import { pipelineCfg } from "../config";
import { majority } from "../grade";
import { actionsPrompt, actionsSystem, extractPrompt, extractSystem, filterPrompt, filterSystem, jevQuestion, jevState, webLeadsPrompt, webLeadsSystem } from "../prompts";
import { assignTier } from "../tier";
import type { ActionItem, CompanyProfile, Deadline, FilterDecision, FrDoc } from "../types";
import { DATE_RE, parseDocNumberFromUrl, verifiedDatesShown, verifyQuotedDate } from "../verify";
import type { RunCtx } from "./context";

// ───────────────────────────── Scan ─────────────────────────────

export async function scan(ctx: RunCtx): Promise<FrDoc[]> {
  const { windowStart, windowEnd } = ctx.run.config;
  return ctx.stage("scan:federal-register", () => listWindow(windowStart, windowEnd), (r) => ({ outCount: r.length }));
}

/**
 * Web leads: a bounded tool loop with Exa. Every URL must resolve to a Federal Register
 * document number; anything that doesn't is dropped (no silent supplement from the web).
 */
export async function webLeads(ctx: RunCtx, profile: CompanyProfile, docs: FrDoc[]) {
  const { windowStart, windowEnd, model } = ctx.run.config;
  const inWindow = new Set(docs.map((d) => d.document_number));
  return ctx.stage(
    "scan:web-leads",
    async () => {
      const r = await ctx.agent("web-leads", {
        model,
        maxSteps: pipelineCfg().webLeads.maxSteps,
        tools: {
          exa_search: gw.tools.exaSearch({
            numResults: pipelineCfg().webLeads.numResults,
            startPublishedDate: `${windowStart}T00:00:00Z`,
            endPublishedDate: `${windowEnd}T23:59:59Z`,
            contents: { highlights: { maxCharacters: pipelineCfg().webLeads.highlightChars } },
          }),
        },
        system: webLeadsSystem(),
        prompt: webLeadsPrompt(profile, windowStart, windowEnd),
      });
      const urls = new Set<string>();
      for (const c of r.toolCalls) {
        const results = (c.output as { results?: { url?: string }[] } | undefined)?.results ?? [];
        results.forEach((x) => x.url && urls.add(x.url));
      }
      r.sources?.forEach((s) => "url" in s && s.url && urls.add(s.url));
      return [...urls].map((url) => {
        const n = parseDocNumberFromUrl(url);
        return { url, document_number: n, inWindow: !!n && inWindow.has(n) };
      });
    },
    (r) => ({ outCount: r.length, note: `${r.filter((x) => x.document_number).length} resolved to FR, ${r.filter((x) => x.inWindow).length} already in scan` }),
  );
}

// ───────────────────────────── Filter ─────────────────────────────

export async function filterJev(ctx: RunCtx, profile: CompanyProfile, docs: FrDoc[]) {
  const limit = pLimit(pipelineCfg().filter.jevConcurrency);
  const question = jevQuestion();
  return ctx.stage(
    "filter:jev",
    async () => {
      const out = new Map<string, number>();
      await Promise.all(
        docs.map((d) =>
          limit(async () => {
            const r = await ctx.jev(jevState(profile, d), question, d.document_number);
            out.set(d.document_number, r.p);
          }),
        ),
      );
      return out;
    },
    (m) => ({ inCount: docs.length, outCount: [...m.values()].filter((p) => p >= ctx.run.config.jevThreshold).length, note: `threshold ${ctx.run.config.jevThreshold}` }),
  );
}

export async function filterLlm(ctx: RunCtx, profile: CompanyProfile, docs: FrDoc[]) {
  const areaKeys = Object.keys(profile.areas) as [string, ...string[]];
  const schema = z.object({
    decisions: z.array(
      z.object({
        document_number: z.string(),
        relevant: z.boolean(),
        reason: z.string().describe("One line, specific to this company. Name the business line affected or why not."),
        areas: z.array(z.enum(areaKeys)).describe("Affected areas; empty if not relevant"),
      }),
    ),
  });
  const system = filterSystem(profile);
  const BATCH = pipelineCfg().filter.llmBatchSize;
  const batches: FrDoc[][] = [];
  for (let i = 0; i < docs.length; i += BATCH) batches.push(docs.slice(i, i + BATCH));
  const limit = pLimit(pipelineCfg().filter.llmConcurrency);

  const votes = ctx.run.config.filterVotes ?? 1;

  // One full pass over every batch. With filterVotes > 1 the passes run in parallel and are combined by majority vote.
  const onePass = async (tag: string) => {
    const out = new Map<string, FilterDec>();
    await Promise.all(
      batches.map((batch, bi) =>
        limit(async () => {
          let pending = batch;
          for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
            const r = await ctx.object(`filter-llm#${tag}${bi}${attempt ? "-retry" : ""}`, {
              model: ctx.run.config.model,
              system,
              prompt: filterPrompt(profile, pending),
              schema,
            });
            const want = new Set(pending.map((d) => d.document_number));
            for (const dec of r.decisions) if (want.has(dec.document_number)) out.set(dec.document_number, dec);
            // Contract check: the model must answer for every input document. Missing ones are retried once.
            pending = pending.filter((d) => !out.has(d.document_number));
          }
        }),
      ),
    );
    return out;
  };

  return ctx.stage(
    "filter:llm",
    async () => combineFilterPasses(await Promise.all(Array.from({ length: votes }, (_, p) => onePass(votes > 1 ? `p${p}#` : ""))), votes),
    (m) => ({
      inCount: docs.length,
      outCount: [...m.values()].filter((x) => x.relevant).length,
      note: `${docs.length - m.size} unanswered after retry${votes > 1 ? ` · ${votes}-pass vote, ${[...m.values()].filter((x) => x.votes && x.votes.yes > 0 && x.votes.no > 0).length} split` : ""}`,
    }),
  );
}

type FilterDec = { relevant: boolean; reason: string; areas: string[] };

/**
 * Majority vote over repeated LLM filter passes (setup knob filterVotes). Each pass is one vote; a pass that didn't
 * answer for a doc abstains. A doc is relevant only with a strict majority of ALL passes saying yes, so abstentions
 * never add up to a yes. Reason and areas come from the first pass that agrees with the outcome.
 * One pass is a pass-through (no votes field), so single-pass runs are unchanged.
 */
export function combineFilterPasses(passes: Map<string, FilterDec>[], votes: number): Map<string, FilterDec & { votes?: { yes: number; no: number; passes: number } }> {
  if (votes === 1) return passes[0];
  const out = new Map<string, FilterDec & { votes: { yes: number; no: number; passes: number } }>();
  for (const n of new Set(passes.flatMap((p) => [...p.keys()]))) {
    const ballots = passes.map((p) => (p.has(n) ? (p.get(n)!.relevant ? "PASS" : "FAIL") : "UNKNOWN") as "PASS" | "FAIL" | "UNKNOWN");
    const relevant = majority(ballots, Math.floor(votes / 2) + 1) === "PASS";
    const answers = passes.map((p) => p.get(n)).filter((d): d is FilterDec => !!d);
    const pick = answers.find((d) => d.relevant === relevant) ?? answers[0];
    out.set(n, { ...pick, relevant, votes: { yes: ballots.filter((b) => b === "PASS").length, no: ballots.filter((b) => b === "FAIL").length, passes: votes } });
  }
  return out;
}

// ───────────────────────────── Verify + Tier (code) ─────────────────────────────

const extractSchema = z.object({
  deadlines: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      kind: z.enum(["comment", "effective", "compliance", "other"]),
      quote: z.string().describe("Exact verbatim sentence from the text that states this date. Copy, do not paraphrase."),
    }),
  ),
});

export async function verifyAndTier(ctx: RunCtx, profile: CompanyProfile, docs: FrDoc[], decisions: Map<string, FilterDecision>) {
  const limit = pLimit(pipelineCfg().verify.concurrency);
  const tierRules = pipelineCfg().tiering;
  const dropped: { document_number: string; why: string }[] = [];
  const items = await ctx.stage(
    "verify+tier",
    async () => {
      const res = await Promise.all(
        docs.map((scanned) =>
          limit(async (): Promise<ActionItem | null> => {
            // 1. Re-fetch from the primary source.
            const doc = await getDoc(scanned.document_number);
            if (!doc) {
              dropped.push({ document_number: scanned.document_number, why: "re-fetch failed: not found on federalregister.gov" });
              ctx.trace.emit("verify.doc", { document_number: scanned.document_number, refetched: false, outcome: "dropped", why: "re-fetch failed" });
              return null;
            }
            const deadlines: Deadline[] = [];
            const fieldCheck = (date: string | null, scannedDate: string | null, kind: Deadline["kind"]) => {
              if (!date && !scannedDate) return;
              const ok = !!date && date === scannedDate;
              deadlines.push({ date: (date ?? scannedDate)!, kind, source: "fr_field", verified: ok, verifyNote: ok ? "matches FR API field on re-fetch" : `scan said ${scannedDate}, re-fetch says ${date}` });
            };
            fieldCheck(doc.comments_close_on, scanned.comments_close_on, "comment");
            fieldCheck(doc.effective_on, scanned.effective_on, "effective");

            // 2. Dates that only live in prose (compliance dates, missing fields): model extracts with a quote, code verifies the quote.
            const { text: raw, source: textSource } = await getRawTextWithSource(doc);
            const skippedDuplicates: { date: string; kind: string; quote: string }[] = [];
            const source = `${doc.dates ?? ""}\n${raw}`;
            const snippet = `${doc.dates ?? ""}\n\n${raw.slice(0, pipelineCfg().verify.snippetChars)}`;
            if (snippet.trim().length > 20) {
              const ex = await ctx.object(`extract-dates:${doc.document_number}`, {
                model: ctx.run.config.model,
                system: extractSystem(),
                prompt: extractPrompt(doc, snippet),
                schema: extractSchema,
                logPrompt: false,
              });
              for (const e of ex.deadlines) {
                if (deadlines.some((d) => d.date === e.date && d.kind === e.kind)) {
                  skippedDuplicates.push(e);
                  continue;
                }
                const v = verifyQuotedDate(source, e.quote, e.date);
                deadlines.push({ date: e.date, kind: e.kind, source: "extracted", quote: e.quote, verified: v.ok, verifyNote: v.ok ? "quote found verbatim in primary source" : v.why });
              }
            }

            const citationVerified = !!doc.citation && doc.citation === scanned.citation;
            ctx.trace.emit("verify.doc", {
              document_number: doc.document_number,
              refetched: true,
              fields: { comments_close_on: doc.comments_close_on, effective_on: doc.effective_on, citation: doc.citation },
              textSource,
              textChars: raw.length,
              fieldChecks: deadlines.filter((d) => d.source === "fr_field"),
              extracted: deadlines.filter((d) => d.source === "extracted"),
              extractedDuplicatesOfFields: skippedDuplicates,
              citationVerified,
            });

            // 3. Tier: pure code.
            const t = assignTier({ type: doc.type, deadlines, asOf: ctx.run.config.asOf, rules: tierRules });
            ctx.trace.emit("tier.assign", { document_number: doc.document_number, docType: doc.type, tier: t.tier, reason: t.reason, deadline: t.deadline, rules: tierRules, asOf: ctx.run.config.asOf });
            const dec = decisions.get(doc.document_number);
            const areas = dec?.llm?.areas ?? [];
            const owner = areas.length ? profile.areas[areas[0]]?.owner ?? profile.generalCounsel : profile.generalCounsel;
            ctx.trace.emit("owner.assign", { document_number: doc.document_number, areas, owner, rule: areas.length ? `first area "${areas[0]}" → its owner` : "no area → general counsel" });
            return {
              document_number: doc.document_number,
              title: doc.title,
              type: doc.type,
              agencies: agencyNames(doc),
              tier: t.tier,
              tierReason: t.reason,
              deadline: t.deadline,
              datesShown: verifiedDatesShown(deadlines),
              deadlines,
              owner,
              areas,
              reason: dec?.llm?.reason ?? (dec?.jevProbability !== undefined ? `Jev p=${dec.jevProbability.toFixed(2)} (no LLM reason)` : ""),
              action: "",
              citation: doc.citation,
              citationVerified,
              url: doc.html_url,
              sourceTag: "[Federal Register]",
            };
          }),
        ),
      );
      return res.filter((x): x is ActionItem => !!x);
    },
    (r) => ({ inCount: docs.length, outCount: r.length, note: `${r.reduce((a, i) => a + i.deadlines.filter((d) => !d.verified).length, 0)} unverified dates dropped from tiering` }),
  );
  return { items, dropped };
}

// ───────────────────────────── Output ─────────────────────────────

const TIER_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 } as const;

export async function writeActions(ctx: RunCtx, profile: CompanyProfile, items: ActionItem[]) {
  if (!items.length) return items;
  const schema = z.object({ actions: z.array(z.object({ document_number: z.string(), action: z.string() })) });
  return ctx.stage(
    "output:actions",
    async () => {
      const r = await ctx.object("output-actions", {
        model: ctx.run.config.model,
        system: actionsSystem(),
        prompt: actionsPrompt(profile, items),
        schema,
      });
      const byNum = new Map(r.actions.map((a) => [a.document_number, a.action]));
      // Guardrail: the LLM text must not smuggle in dates. Strip any that slipped through.
      return items
        .map((i) => {
          const raw = byNum.get(i.document_number) ?? "Review.";
          const final = raw.replace(DATE_RE, "[date — see deadline]");
          ctx.trace.emit("action.write", { document_number: i.document_number, raw, final, stripped: raw !== final, missingFromModel: !byNum.has(i.document_number) });
          return { ...i, action: final };
        })
        .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || (a.deadline?.date ?? "9").localeCompare(b.deadline?.date ?? "9"));
    },
    (r) => ({ outCount: r.length }),
  );
}

export function renderMarkdown(profile: CompanyProfile, cfg: { windowStart: string; windowEnd: string; asOf: string }, items: ActionItem[]) {
  const lines = [`# Regulatory triage — ${profile.name}`, `Window ${cfg.windowStart} → ${cfg.windowEnd} · as of ${cfg.asOf} · ${items.length} items`, ""];
  for (const tier of ["Critical", "High", "Medium", "Low"] as const) {
    const group = items.filter((i) => i.tier === tier);
    if (!group.length) continue;
    lines.push(`## ${tier} (${group.length})`, "");
    for (const i of group) {
      lines.push(
        `- **${i.title}** ${i.sourceTag}`,
        `  - ${i.action}`,
        `  - Dates: ${(i.datesShown ?? (i.deadline ? [i.deadline] : [])).map((d) => `${d.kind} ${d.date} ✓`).join(" · ") || "none found"} · Owner: ${i.owner.name} · Areas: ${i.areas.join(", ") || "—"}`,
        `  - ${i.citation ?? i.document_number}${i.citationVerified ? " ✓" : " (unverified)"} · ${i.url}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
