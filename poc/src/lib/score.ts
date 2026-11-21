import type { LabelSet, RunRecord } from "./types";

/**
 * Deterministic graders (Anthropic "demystifying evals": code where possible, model where necessary).
 * Ground truth = hand-labeled set of Federal Register document numbers. Recall/precision are set math.
 */
export function scoreRun(run: RunRecord, labels: LabelSet) {
  const truth = new Set(labels.relevant);
  const predicted = [...new Set((run.items ?? []).map((i) => i.document_number))];
  const tp = predicted.filter((n) => truth.has(n)).length;
  const fp = predicted.length - tp;
  const missed = [...truth].filter((n) => !predicted.includes(n));
  const items = run.items ?? [];
  const withDate = items.filter((i) => i.deadline);
  return {
    tp,
    fp,
    fn: missed.length,
    recall: truth.size ? tp / truth.size : 0,
    precision: predicted.length ? tp / predicted.length : 0,
    missed,
    extra: predicted.filter((n) => !truth.has(n)),
    /** Claims that never resolved to a primary-source record (baseline hallucinations / secondary sources). */
    unresolved: run.dropped?.length ?? 0,
    datesShown: withDate.length,
    datesVerified: withDate.filter((i) => i.deadline!.verified).length,
    citationsVerified: items.filter((i) => i.citationVerified).length,
    costUsd: run.totalCostUsd,
    ms: run.totalMs,
  };
}

/** Consistency across repeated runs of the same config (RFC: tier identical, relevance agrees on ≥ 90%). */
export function consistency(runs: RunRecord[]) {
  const sets = runs.map((r) => new Set((r.items ?? []).map((i) => i.document_number)));
  const union = new Set(sets.flatMap((s) => [...s]));
  const agreeRel = [...union].filter((n) => sets.every((s) => s.has(n)) || sets.every((s) => !s.has(n))).length;
  const inAll = [...union].filter((n) => sets.every((s) => s.has(n)));
  const tierOf = (r: RunRecord, n: string) => r.items?.find((i) => i.document_number === n)?.tier;
  const agreeTier = inAll.filter((n) => runs.every((r) => tierOf(r, n) === tierOf(runs[0], n))).length;
  return {
    runs: runs.length,
    unionSize: union.size,
    relevanceAgreement: union.size ? agreeRel / union.size : 1,
    tierAgreement: inAll.length ? agreeTier / inAll.length : 1,
    disagreements: [...union].filter((n) => !(sets.every((s) => s.has(n)) || sets.every((s) => !s.has(n)))),
  };
}

/** How the Jev prefilter behaves at each threshold: recall it preserves vs. how many docs it sends to the LLM. */
export function jevSweep(run: RunRecord, labels: LabelSet, thresholds = [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
  const truth = new Set(labels.relevant);
  const decs = (run.decisions ?? []).filter((d) => d.jevProbability !== undefined);
  return thresholds.map((t) => {
    const passed = decs.filter((d) => d.jevProbability! >= t);
    const tp = passed.filter((d) => truth.has(d.document_number)).length;
    return { threshold: t, passed: passed.length, recall: truth.size ? tp / truth.size : 0, precision: passed.length ? tp / passed.length : 0 };
  });
}
