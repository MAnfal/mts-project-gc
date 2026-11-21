import pLimit from "p-limit";
import { z } from "zod";
import { gw } from "../gateway";
import { agencyNames, getDoc, getRawText, listWindow } from "../fr";
import { profileBrief } from "../profiles";
import { assignTier } from "../tier";
import type { ActionItem, CompanyProfile, Deadline, FilterDecision, FrDoc } from "../types";
import { parseDocNumberFromUrl, verifyQuotedDate } from "../verify";
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
        maxSteps: 4,
        tools: {
          exa_search: gw.tools.exaSearch({
            numResults: 8,
            startPublishedDate: `${windowStart}T00:00:00Z`,
            endPublishedDate: `${windowEnd}T23:59:59Z`,
            contents: { highlights: { maxCharacters: 300 } },
          }),
        },
        system: "You find leads on new US federal regulatory actions. Search, then list the URLs you found. Do not summarise law from memory.",
        prompt: `${profileBrief(profile)}\n\nFind US federal regulatory developments (final rules, proposed rules, guidance, enforcement) published ${windowStart} to ${windowEnd} that could affect this company. Run at most 3 searches. Reply with the URLs only.`,
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

const docBlock = (d: FrDoc) =>
  [`[${d.document_number}] ${d.type} — ${agencyNames(d).join("; ")}`, `Title: ${d.title}`, d.action ? `Action: ${d.action}` : "", `Abstract: ${(d.abstract ?? "(none)").slice(0, 1200)}`]
    .filter(Boolean)
    .join("\n");

const JEV_QUESTION =
  "Would the general counsel of this company need to know about this federal document because it could create, change or remove a compliance obligation or material legal risk for the company's actual business lines? Routine filings for other industries are not relevant.";

export async function filterJev(ctx: RunCtx, profile: CompanyProfile, docs: FrDoc[]) {
  const brief = profileBrief(profile);
  const limit = pLimit(16);
  return ctx.stage(
    "filter:jev",
    async () => {
      const out = new Map<string, number>();
      await Promise.all(
        docs.map((d) =>
          limit(async () => {
            const r = await ctx.jev(`${brief}\n\n--- DOCUMENT ---\n${docBlock(d)}`, JEV_QUESTION);
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
  const system = `You are an in-house regulatory analyst triaging the Federal Register for one company. Be precise: mark relevant only if the document could create, change or remove an obligation or material legal risk for the company's actual business lines. Return exactly one decision per document number given — no more, no fewer.\n\nAffected areas:\n${Object.entries(profile.areas)
    .map(([k, v]) => `- ${k}: ${v.description}`)
    .join("\n")}`;
  const BATCH = 20;
  const batches: FrDoc[][] = [];
  for (let i = 0; i < docs.length; i += BATCH) batches.push(docs.slice(i, i + BATCH));
  const limit = pLimit(4);

  return ctx.stage(
    "filter:llm",
    async () => {
      const out = new Map<string, { relevant: boolean; reason: string; areas: string[] }>();
      await Promise.all(
        batches.map((batch, bi) =>
          limit(async () => {
            let pending = batch;
            for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
              const r = await ctx.object(`filter-llm#${bi}${attempt ? "-retry" : ""}`, {
                model: ctx.run.config.model,
                system,
                prompt: `${profileBrief(profile)}\n\n=== DOCUMENTS (${pending.length}) ===\n\n${pending.map(docBlock).join("\n\n")}`,
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
    },
    (m) => ({ inCount: docs.length, outCount: [...m.values()].filter((x) => x.relevant).length, note: `${docs.length - m.size} unanswered after retry` }),
  );
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
  const limit = pLimit(6);
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
            const raw = await getRawText(doc);
            const source = `${doc.dates ?? ""}\n${raw}`;
            const snippet = `${doc.dates ?? ""}\n\n${raw.slice(0, 7000)}`;
            if (snippet.trim().length > 20) {
              const ex = await ctx.object(`extract-dates:${doc.document_number}`, {
                model: ctx.run.config.model,
                system: "Extract every dated obligation or deadline (comment due, effective, compliance) stated in the text. Quote the sentence verbatim. If none, return an empty list.",
                prompt: `Document ${doc.document_number}: ${doc.title}\n\n${snippet}`,
                schema: extractSchema,
                logPrompt: false,
              });
              for (const e of ex.deadlines) {
                if (deadlines.some((d) => d.date === e.date && d.kind === e.kind)) continue;
                const v = verifyQuotedDate(source, e.quote, e.date);
                deadlines.push({ date: e.date, kind: e.kind, source: "extracted", quote: e.quote, verified: v.ok, verifyNote: v.ok ? "quote found verbatim in primary source" : v.why });
              }
            }

            // 3. Tier: pure code.
            const t = assignTier({ type: doc.type, deadlines, asOf: ctx.run.config.asOf });
            const dec = decisions.get(doc.document_number);
            const areas = dec?.llm?.areas ?? [];
            const owner = areas.length ? profile.areas[areas[0]]?.owner ?? profile.generalCounsel : profile.generalCounsel;
            return {
              document_number: doc.document_number,
              title: doc.title,
              type: doc.type,
              agencies: agencyNames(doc),
              tier: t.tier,
              tierReason: t.reason,
              deadline: t.deadline,
              deadlines,
              owner,
              areas,
              reason: dec?.llm?.reason ?? (dec?.jevProbability !== undefined ? `Jev p=${dec.jevProbability.toFixed(2)} (no LLM reason)` : ""),
              action: "",
              citation: doc.citation,
              citationVerified: !!doc.citation && doc.citation === scanned.citation,
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
        system:
          "Write one action item per document for a busy general counsel: an imperative sentence (≤ 25 words) saying what the owner should do and why, in plain English a non-lawyer understands — spell out acronyms, no regulatory jargon. Do NOT write any dates or citations — those are rendered separately from verified data.",
        prompt: `${profileBrief(profile)}\n\n${items
          .map((i) => `[${i.document_number}] ${i.type}: ${i.title}\nTier: ${i.tier} (${i.tierReason})\nOwner: ${i.owner.name}\nWhy relevant: ${i.reason}`)
          .join("\n\n")}`,
        schema,
      });
      const byNum = new Map(r.actions.map((a) => [a.document_number, a.action]));
      // Guardrail: the LLM text must not smuggle in dates. Strip any that slipped through.
      const DATE_RE = /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}, \d{4}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g;
      return items
        .map((i) => ({ ...i, action: (byNum.get(i.document_number) ?? "Review.").replace(DATE_RE, "[date — see deadline]") }))
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
        `  - Deadline: ${i.deadline ? `${i.deadline.date} (${i.deadline.kind}, ${i.deadline.source === "fr_field" ? "FR field" : "quoted"} ✓)` : "none found"} · Owner: ${i.owner.name} · Areas: ${i.areas.join(", ") || "—"}`,
        `  - ${i.citation ?? i.document_number}${i.citationVerified ? " ✓" : " (unverified)"} · ${i.url}`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}
