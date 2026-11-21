// Error analysis for one setup in a suite: gathers EVERY failure signal (code vs key, trace checks, judge panel),
// from DEV-split weeks only (test weeks are held out: tuning on them would make them stop measuring generalisation),
// buckets what code can bucket, then one LLM pass groups the rest into root causes with a proposed config change.
// Output: <out>/error-analysis.json (+ .md) — the input for choosing the next iteration.
//   npx tsx scripts/error-analysis.mts <suite> <setup> <outDir> [--llm]
import fs from "node:fs";
import path from "node:path";
import { generateText, Output } from "ai";
import { z } from "zod";
import { arenaRuns } from "../src/lib/arena";
import { evalsets, getCompany, loadKey, pipelineCfg } from "../src/lib/config";
import { gatewayCost, languageModel } from "../src/lib/gateway";
import { aggregateSteps, formatSteps, gradeRun, stepGrade, trapsOf } from "../src/lib/grade";
import { archiveSpend } from "../src/lib/store";
import { readTrace } from "../src/lib/trace";
import { checkTrace } from "../src/lib/trace-checks";

const [suite, setup, outDir] = process.argv.slice(2);
const useLlm = process.argv.includes("--llm");
// Held-out guard: only runs on dev-split weeks are analysed. There is deliberately no override flag.
const devSets = new Set(evalsets().filter((e) => e.split === "dev").map((e) => e.id));
const all = (await arenaRuns(suite)).filter((r) => r.config.cell === setup && r.status === "done");
const runs = all.filter((r) => r.config.evalset && devSets.has(r.config.evalset));
if (!runs.length) throw new Error(`no finished dev-split runs for ${setup} in ${suite}`);
console.log(`analysing ${runs.length} dev-split runs (${all.length - runs.length} test-split runs excluded, never read)`);

type Failure = { signal: "relevance" | "fact" | "trace" | "judge"; kind: string; evalset: string; doc?: string; repeat: number; bucket: string; detail: Record<string, unknown> };
const failures: Failure[] = [];

for (const run of runs) {
  const c = run.config;
  const key = loadKey(c.profileId, c.windowStart, c.windowEnd)!;
  const g = gradeRun(run, key, getCompany(c.profileId), pipelineCfg().tiering);
  const trace = readTrace(run.id);
  const decision = (n: string) => trace.find((e) => e.type === "filter.decision" && e.document_number === n) as { jevProbability?: number; passedJev?: boolean; llm?: { relevant: boolean; reason: string } } | undefined;
  const base = { evalset: c.evalset!, repeat: c.repeatIndex ?? 0 };
  const traps = trapsOf(key);

  // 1. Relevance (code vs key), bucketed by where in the pipeline it went wrong.
  for (const n of g.missed) {
    const d = decision(n);
    failures.push({ ...base, signal: "relevance", kind: "missed", doc: n, bucket: d?.passedJev === false ? "jev-dropped-a-real-rule" : d?.llm && !d.llm.relevant ? "llm-filter-rejected-a-real-rule" : "lost-after-filter", detail: { keyReason: key.details?.[n]?.reason, kind: key.details?.[n]?.kind, jevP: d?.jevProbability, llmReason: d?.llm?.reason } });
  }
  for (const n of [...g.trapHits, ...g.unlabeled]) {
    const d = decision(n);
    const t = traps[n];
    failures.push({ ...base, signal: "relevance", kind: t ? "fell-for-trap" : "extra-flag", doc: n, bucket: t ? `trap:${t.trapType}` : "unlabeled-extra", detail: { trapReason: t?.reason, jevP: d?.jevProbability, llmReason: d?.llm?.reason } });
  }
  // 2. Facts on found items (date / tier / owner), straight from the grader.
  const item = (n: string) => run.items?.find((i) => i.document_number === n);
  for (const n of key.relevant) {
    const it = item(n);
    const d = key.details?.[n];
    if (!it || !d) continue;
    if (d.deadline && !(it.deadline && [d.deadline.date, ...(d.acceptDates ?? [])].includes(it.deadline.date)))
      failures.push({ ...base, signal: "fact", kind: "date-wrong", doc: n, bucket: it.deadline ? "date-differs" : "no-headline-date", detail: { expected: d.deadline, shown: it.deadline, allFound: it.deadlines.map((x) => `${x.kind} ${x.date}${x.verified ? "" : " (unverified)"}`), docType: d.docType, tier: it.tier } });
  }
  // 3. Process (trace checks).
  for (const ch of checkTrace(trace as never).filter((x) => !x.pass)) failures.push({ ...base, signal: "trace", kind: ch.id, bucket: `trace:${ch.id}`, detail: { detail: ch.detail } });
  // 4. Judge panel: every non-PASS verdict, with each judge's reason and what the judge was shown.
  for (const v of run.panel?.verdicts ?? []) {
    if (v.verdict === "PASS") continue;
    const reasons = (run.panel?.judges ?? []).map((j) => ({ judge: j.model, vote: j.votes.find((x) => x.document_number === v.document_number && x.criterion === v.criterion)?.verdict, why: j.votes.find((x) => x.document_number === v.document_number && x.criterion === v.criterion)?.why }));
    const rubric = key.details?.[v.document_number]?.rubric;
    // A "covers" failure that is only about a date the action deliberately omits is the eval's fault, not the system's.
    const onlyDate = v.criterion === "covers" && reasons.filter((x) => x.vote === "FAIL").every((x) => /deadline|due|date|December|January|November|20\d\d/i.test(x.why ?? ""));
    failures.push({ ...base, signal: "judge", kind: `${v.criterion}:${v.verdict}`, doc: v.document_number, bucket: onlyDate ? "eval-unfair:judge-penalises-omitted-date" : `judge:${v.criterion}`, detail: { action: item(v.document_number)?.action, rubric, reasons } });
  }
}

// Distinct failures (same doc + kind across repeats counted once, with frequency).
const distinct = new Map<string, Failure & { times: number }>();
for (const f of failures) {
  const k = `${f.signal}|${f.kind}|${f.evalset}|${f.doc ?? ""}`;
  const prev = distinct.get(k);
  distinct.set(k, prev ? { ...prev, times: prev.times + 1 } : { ...f, times: 1 });
}
const rows = [...distinct.values()];
const buckets = Object.entries(rows.reduce((a, f) => ((a[f.bucket] = (a[f.bucket] ?? 0) + f.times), a), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]);

// Per-step scores on the same dev runs (Jev → LLM filter → verify), so root causes can be pinned to a step.
const steps = aggregateSteps(runs.map((r) => stepGrade(r, loadKey(r.config.profileId, r.config.windowStart, r.config.windowEnd)!)));
const stepLines = formatSteps(steps);
console.log(["per-step scores (dev):", ...stepLines].join("\n"));
let llm: unknown = null;
if (useLlm) {
  const model = "anthropic/claude-opus-5.5";
  const r = await generateText({
    model: languageModel(model),
    output: Output.object({
      schema: z.object({
        rootCauses: z.array(
          z.object({
            cause: z.string(),
            whose: z.enum(["system", "eval", "unclear"]).describe("system = the pipeline is wrong; eval = the key/rubric/judge setup is unfair or wrong"),
            failures: z.number(),
            examples: z.array(z.string()).describe("doc numbers"),
            proposedChange: z.string().describe("one concrete change to config/ (prompt set, pipeline knob, judge input, key review) and why it should help"),
            risk: z.string().describe("what it might break (e.g. recall)"),
          }),
        ),
      }),
    }),
    prompt: `You are doing error analysis (open + axial coding) for a regulatory-triage pipeline. Below are every failure of one setup across ${runs.length} runs (development weeks only), already partly bucketed by code. Group them into a few root causes, ranked by how many failures each explains. Say whether each is the SYSTEM's fault or the EVAL's (unfair rubric, judge missing context, debatable key). For each, propose ONE concrete change to the configuration and its risk.

Pipeline facts you need: actions deliberately contain NO dates (dates are shown separately, only from verified sources). Tiering is code. The LLM filter decides relevance with a system prompt (prompt set "strict" lists exclusions).

Per-step scores on these runs (which step loses flags or lets traps through):
${stepLines.join("\n")}

Code buckets (bucket → failure count): ${JSON.stringify(buckets)}

Failures (distinct, with how many runs hit them):
${JSON.stringify(rows.map(({ signal, kind, evalset, doc, bucket, times, detail }) => ({ signal, kind, evalset, doc, bucket, times, detail })), null, 1).slice(0, 60000)}`,
  });
  const cost = gatewayCost(r.providerMetadata) || r.steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0);
  await archiveSpend({ reason: `error analysis (${setup} in ${suite}) with ${model}`, runs: 0, usd: cost });
  llm = { model, costUsd: cost, ...r.output };
}

fs.mkdirSync(outDir, { recursive: true });
const out = { suite, setup, split: "dev", excludedTestRuns: all.length - runs.length, runs: runs.length, generatedAt: new Date().toISOString(), totals: { failures: failures.length, distinct: rows.length }, bySignal: Object.fromEntries(["relevance", "fact", "trace", "judge"].map((s) => [s, failures.filter((f) => f.signal === s).length])), buckets, steps, rows, llm };
fs.writeFileSync(path.join(outDir, "error-analysis.json"), JSON.stringify(out, null, 2));
console.log(`${failures.length} failures (${rows.length} distinct) by signal ${JSON.stringify(out.bySignal)}`);
for (const [b, n] of buckets) console.log(`  ${String(n).padStart(3)}  ${b}`);
if (llm) for (const c of (llm as { rootCauses: { cause: string; whose: string; failures: number; proposedChange: string }[] }).rootCauses) console.log(`\n[${c.whose}] ${c.cause} (${c.failures})\n   → ${c.proposedChange}`);
