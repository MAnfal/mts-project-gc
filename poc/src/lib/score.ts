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

/** Dates graded against the key: for found docs whose key has a deadline, does the shown date match exactly? */
export function datesAgainstKey(run: RunRecord, key: LabelSet) {
  const wrong: string[] = [];
  let checked = 0;
  for (const it of run.items ?? []) {
    const expected = key.details?.[it.document_number]?.deadline;
    if (!key.relevant.includes(it.document_number) || !expected) continue;
    checked++;
    if (it.deadline?.date !== expected.date) wrong.push(it.document_number);
  }
  return { checked, correct: checked - wrong.length, wrong };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** One arena row: every run of one config. Failed runs are shown, not hidden, and their spend still counts. */
export function summarizeCell(runs: RunRecord[], key: LabelSet) {
  const done = runs.filter((r) => r.status === "done");
  const scores = done.map((r) => scoreRun(r, key));
  const dates = done.map((r) => datesAgainstKey(r, key));
  const clarity = done.map((r) => r.judge?.clarity).filter((c): c is number => typeof c === "number");
  return {
    runs: runs.length,
    finished: done.length,
    failed: runs.filter((r) => r.status === "error").length,
    running: runs.filter((r) => r.status === "running").length,
    recall: mean(scores.map((s) => s.recall)),
    precision: mean(scores.map((s) => s.precision)),
    found: mean(scores.map((s) => s.tp)),
    extra: mean(scores.map((s) => s.fp)),
    missed: mean(scores.map((s) => s.fn)),
    datesChecked: dates.reduce((a, d) => a + d.checked, 0),
    datesCorrect: dates.reduce((a, d) => a + d.correct, 0),
    unverifiedShown: scores.reduce((a, s) => a + (s.datesShown - s.datesVerified), 0),
    clarity: mean(clarity),
    consistency: done.length >= 2 ? consistency(done) : null,
    costUsd: runs.reduce((a, r) => a + r.totalCostUsd + (r.judge?.costUsd ?? 0), 0),
    msMean: mean(done.map((r) => r.totalMs)),
    errors: runs.filter((r) => r.error).map((r) => r.error!),
  };
}

export type CellSummary = ReturnType<typeof summarizeCell>;

export function arenaTotals(cells: CellSummary[]) {
  return { runs: cells.reduce((a, c) => a + c.runs, 0), costUsd: cells.reduce((a, c) => a + c.costUsd, 0) };
}
