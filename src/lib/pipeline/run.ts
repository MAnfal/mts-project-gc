import "server-only";
import { getCompany, withPromptSet } from "../config";
import type { ActionItem, CompanyProfile, FilterDecision, FrDoc, RunConfig } from "../types";
import { RunCtx, StepFailed, type TraceSink } from "./context";
import { assertPublic, heldBack, screenedOut, stepOf, TIMEOUT_MESSAGE, UNEXPECTED_MESSAGE, type RunEvent } from "./events";
import { RetriesExhausted, withRetryScope } from "./retry";
import { filterJev, filterLlm, filterPassages, renderMarkdown, scan, verifyAndTier, writeActions } from "./stages";

// Ported from poc:poc/src/lib/pipeline/run.ts: the pipeline path only. The relevance cut and the verdict merge
// in pipeline() are the POC's lines unchanged. Gone: the baseline mode (eval only), web leads (off in every
// evaluated setup; their results never fed a decision) and saving the run record (nothing is written server-side).

export interface PipelineResult {
  items: ActionItem[];
  dropped: { document_number: string; why: string }[];
  /** Per scanned document, server-side only: carries the internal relevance score. */
  decisions: FilterDecision[];
  markdown: string;
}

/** The run failed and has already emitted step.failed (when inside a step) and run.failed. */
export class RunFailed extends Error {
  constructor(cause: unknown) {
    super("run failed", { cause });
    this.name = "RunFailed";
  }
}

/**
 * Runs the live pipeline once, streaming public events to `emit`. Emits exactly one terminal event: run.done, or
 * run.failed (after step.failed when a step was running). Resolves with the result on run.done; rejects with
 * RunFailed on run.failed, so the caller never needs to emit one itself.
 */
export async function runPipeline(config: RunConfig, emit: (e: RunEvent) => void, opts: { trace?: TraceSink } = {}): Promise<PipelineResult> {
  const t0 = Date.now();
  let profile: CompanyProfile;
  try {
    profile = config.customProfile ?? getCompany(config.profileId);
  } catch (e) {
    console.error("[Pipeline] no profile:", e);
    const failed: RunEvent = { type: "run.failed", step: null, message: UNEXPECTED_MESSAGE };
    assertPublic(failed);
    emit(failed);
    throw new RunFailed(e);
  }
  const ctx = new RunCtx({ config }, profile.name, emit, opts.trace ? { emit: opts.trace } : undefined);
  try {
    ctx.emit({
      type: "run.start",
      company: profile.name,
      windowStart: config.windowStart,
      windowEnd: config.windowEnd,
      asOf: config.asOf,
      steps: plannedStages(config).map((s) => stepOf(s, profile.name)),
    });
    const out = await withRetryScope({ onRetry: ctx.onRetry, stopped: ctx.stopped }, () => withPromptSet(config.promptSet, () => pipeline(ctx, profile)));
    ctx.emit({
      type: "run.done",
      items: out.items,
      dropped: heldBack(out.docs, out.dropped),
      screenedOut: screenedOut(out.docs, out.decisionMap),
      notReviewedCount: out.docs.length - out.sentToLlm,
      scanned: out.docs.length,
      markdown: out.markdown,
      ms: Date.now() - t0,
    });
    console.info(`[Pipeline] done: ${out.docs.length} scanned, ${out.items.length} items, $${ctx.totalCostUsd.toFixed(3)}, ${Date.now() - t0} ms`);
    return { items: out.items, dropped: out.dropped, decisions: [...out.decisionMap.values()], markdown: out.markdown };
  } catch (e) {
    ctx.failed = true;
    console.error("[Pipeline] failed:", e);
    const message = rootCause(e) instanceof RetriesExhausted ? TIMEOUT_MESSAGE : UNEXPECTED_MESSAGE;
    const step = e instanceof StepFailed ? e : null;
    if (step) ctx.emit({ type: "step.failed", step: step.step, label: step.label, message });
    ctx.emit({ type: "run.failed", step: step?.step ?? null, message });
    throw new RunFailed(e);
  }
}

const rootCause = (e: unknown) => (e instanceof StepFailed ? e.cause : e);

/** The stages pipeline() runs for this config, in order (what the GC sees as waiting steps). */
export function plannedStages(cfg: RunConfig): string[] {
  return [
    "scan:federal-register",
    ...(cfg.filter !== "llm" ? ["filter:jev"] : []),
    ...(cfg.filter !== "llm" && cfg.filterExcerpts && cfg.filter !== "jev" ? ["filter:passages"] : []),
    ...(cfg.filter !== "jev" ? ["filter:llm"] : []),
    "verify+tier",
    "output:actions",
  ];
}

async function pipeline(ctx: RunCtx, profile: CompanyProfile) {
  const cfg = ctx.run.config;

  const docs: FrDoc[] = await scan(ctx);
  ctx.trace.emit("scan.result", { count: docs.length, documents: docs.map((d) => ({ document_number: d.document_number, type: d.type, title: d.title })) });

  const decisions = new Map<string, FilterDecision>(docs.map((d) => [d.document_number, { document_number: d.document_number, relevant: false }]));
  let toLlm = docs;
  let passages: Map<string, string[]> | undefined;
  if (cfg.filter !== "llm") {
    const probs = await filterJev(ctx, profile, docs);
    for (const [n, p] of probs) decisions.get(n)!.jevProbability = p;
    toLlm = docs.filter((d) => (probs.get(d.document_number) ?? 0) >= cfg.jevThreshold);
    if (cfg.filter === "jev") for (const d of toLlm) decisions.get(d.document_number)!.relevant = true;
    if (cfg.filterExcerpts && cfg.filter !== "jev") passages = await filterPassages(ctx, profile, toLlm, probs);
  }
  if (cfg.filter !== "jev") {
    const llm = await filterLlm(ctx, profile, toLlm, passages);
    for (const [n, v] of llm) {
      const dec = decisions.get(n)!;
      dec.llm = v;
      dec.relevant = v.relevant;
    }
  }
  const sentToLlm = new Set(toLlm.map((d) => d.document_number));
  for (const d of decisions.values())
    ctx.trace.emit("filter.decision", {
      document_number: d.document_number,
      jevProbability: d.jevProbability ?? null,
      jevThreshold: cfg.filter === "llm" ? null : cfg.jevThreshold,
      passedJev: cfg.filter === "llm" ? null : sentToLlm.has(d.document_number),
      llm: d.llm ?? null,
      relevant: d.relevant,
    });

  const relevantDocs = docs.filter((d) => decisions.get(d.document_number)!.relevant);
  const { items, dropped } = await verifyAndTier(ctx, profile, relevantDocs, decisions);
  const final = await writeActions(ctx, profile, items);
  const markdown = renderMarkdown(profile, cfg, final);
  return { docs, decisionMap: decisions, sentToLlm: sentToLlm.size, items: final, dropped, markdown };
}
