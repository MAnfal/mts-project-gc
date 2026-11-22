import type { EvalIndex, Metric, SetupResult } from "./index-schema";

/**
 * The Models page's comparisons (chunk 10), from index.json alone: `suiteResults` (each setup over one suite,
 * already labelled with split, runs and suite), `suites[]` (weeks) and `setups[]` (model, method, prompt set).
 * Models are compared only within one suite, so every row shares the same eval set, keys and week of running;
 * a suite that ran one model is named, not compared. Pure and client-safe.
 */

type SetupInfo = EvalIndex["setups"][number];

/** One setup's results in one suite, with what it ran. `live` = it runs the live setup's model. */
export type ModelRow = Pick<SetupInfo, "label" | "model" | "modelLabel" | "method" | "promptSet"> & {
  setup: string;
  live: boolean;
  result: SetupResult;
};

export type ModelGroup = {
  suite: string;
  weeks: EvalIndex["suites"][number]["weeks"];
  /** The suite's run records (every setup, failed ones included) and company-week eval sets. */
  runs: number;
  evalsets: number;
  /** Model labels in the suite, the live model first. */
  models: string[];
  rows: ModelRow[];
};

export type ModelComparisons = {
  /** The live setup and the model it runs: the rows to highlight. */
  live: { setup: string; model: string; modelLabel: string; promptSet: string | null };
  /** One group per suite that ran more than one model, in suite order. */
  groups: ModelGroup[];
  /** Every other suite, with the model(s) it ran: shown as "single model, no comparison". */
  singleModel: { suite: string; models: string[] }[];
};

/** The single-prompt baseline is a method of its own; every other method is a pipeline. */
export const isPipeline = (r: Pick<ModelRow, "method">) => r.method !== "baseline";
/** "anthropic/claude-sonnet-5.5" → "anthropic". */
const vendorOf = (model: string) => model.split("/")[0];
const promptOf = (r: Pick<ModelRow, "promptSet">) => r.promptSet ?? "default";

/** Pipelines before the baseline, then by method and prompt set (default first), then the live model first. */
function rowOrder(a: ModelRow, b: ModelRow): number {
  const key = (r: ModelRow) => [isPipeline(r) ? 0 : 1, r.method, promptOf(r) === "default" ? "" : promptOf(r), r.live ? 0 : 1] as const;
  const [x, y] = [key(a), key(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/**
 * Groups each suite's own results (never a pooled one) by the models they ran. Throws when the live setup, or a
 * setup a suite has results for, is missing from `index.setups` (its model would be unknown), and when a suite lists a
 * setup with no result of its own (its row would silently vanish). The page shows the message instead of a table.
 */
export function modelComparisons(index: Pick<EvalIndex, "suites" | "setups" | "suiteResults" | "live">): ModelComparisons {
  const infoOf = new Map(index.setups.map((s) => [s.key, s]));
  const liveInfo = infoOf.get(index.live.setup);
  if (!liveInfo) throw new Error(`live setup ${index.live.setup} is not in index.setups`);
  const live = { setup: liveInfo.key, model: liveInfo.model, modelLabel: liveInfo.modelLabel, promptSet: liveInfo.promptSet };

  const groups: ModelGroup[] = [];
  const singleModel: ModelComparisons["singleModel"] = [];
  for (const s of index.suites) {
    const rows = index.suiteResults
      .filter((r) => r.suite.length === 1 && r.suite[0] === s.id)
      .map((result): ModelRow => {
        const i = infoOf.get(result.setup);
        if (!i) throw new Error(`suite ${s.id} has results for setup ${result.setup}, which index.setups lacks`);
        return { setup: i.key, label: i.label, model: i.model, modelLabel: i.modelLabel, method: i.method, promptSet: i.promptSet, live: i.model === live.model, result };
      })
      .sort(rowOrder);
    // The builder writes one result per suite × setup; a listed setup without one would vanish from the table
    // and could turn a two-model suite into "single model", so it is an error, not a smaller table.
    const missing = s.setups.find((x) => !rows.some((r) => r.setup === x.key));
    if (missing) throw new Error(`suite ${s.id} lists setup ${missing.key}, but index.json has no result for it in that suite`);
    const models = [...new Set(rows.map((r) => r.modelLabel))];
    if (models.length > 1) groups.push({ suite: s.id, weeks: s.weeks, runs: s.runs, evalsets: s.evalsets.length, models, rows });
    else singleModel.push({ suite: s.id, models });
  }
  return { live, groups, singleModel };
}

/** Pairs in a group that differ only in model: same method and prompt set, the live model against another. */
export function likeForLike(group: ModelGroup): { live: ModelRow; other: ModelRow }[] {
  return group.rows.flatMap((l) =>
    l.live ? group.rows.filter((o) => !o.live && o.method === l.method && promptOf(o) === promptOf(l)).map((other) => ({ live: l, other })) : [],
  );
}

/**
 * The lowest recall (all weeks) among the group's pipeline setups, the comparison set named by `among`. The
 * baseline is left out: it is not a pipeline. `onlyOtherVendor` is true when the lowest setups are exactly the
 * pipeline setups whose model is not from the live model's vendor (`otherVendor`).
 */
export function lowestRecall(group: ModelGroup, liveVendor = vendorOf(group.rows.find((r) => r.live)?.model ?? "")) {
  const among = group.rows.filter((r) => isPipeline(r) && r.result.recall.all.value !== null);
  const min = Math.min(...among.map((r) => r.result.recall.all.value!));
  const lowest = among.filter((r) => r.result.recall.all.value === min);
  const others = among.filter((r) => vendorOf(r.model) !== liveVendor);
  const onlyOtherVendor = others.length > 0 && lowest.length === others.length && lowest.every((r) => vendorOf(r.model) !== liveVendor);
  return { among, lowest, otherVendor: others, onlyOtherVendor };
}

export const COMPARED = ["recall", "precision", "datesRight", "judgePass", "costPerRunUsd", "secondsPerRun"] as const satisfies readonly Metric[];

/**
 * a minus b on each compared measure (all weeks), with which way a lies from b. `runs` are the two values' own
 * denominators, so a sentence can say what each was computed over. Null when either side has no value.
 */
export function compareRows(a: SetupResult, b: SetupResult) {
  return Object.fromEntries(
    COMPARED.map((m) => {
      const [x, y] = [a[m].all.value, b[m].all.value];
      const diff = x === null || y === null ? null : x - y;
      const direction = diff === null ? null : diff > 0 ? "higher" : diff < 0 ? "lower" : "same";
      return [m, { a: x, b: y, diff, direction, runs: [a[m].all.runs, b[m].all.runs] as [number, number] }];
    }),
  ) as Record<(typeof COMPARED)[number], { a: number | null; b: number | null; diff: number | null; direction: "higher" | "lower" | "same" | null; runs: [number, number] }>;
}
