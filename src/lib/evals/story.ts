import { METRICS, SPLITS, type EvalIndex } from "./index-schema";
import { compareRows, COMPARED, isPipeline, likeForLike, lowestRecall, modelComparisons, type ModelComparisons } from "./models";
import type { EvalStory, Quote } from "./story-schema";
import { SCOREBOARD_MEASURES, type Verdict } from "./verdict";

/**
 * Fills config/eval-story.yaml's {{placeholders}} from index.json, so the prose can be reworded freely while
 * every number in it stays the recorded one. Pure and client-safe.
 */

/** "06-passages" → "06": the iteration's number, shown before its label. */
export const iterationNumber = (id: string) => id.split("-")[0];

/** "arena-2026-11-21-22-52-l92" → "l92": suites are named by their short id on screen, in full in tooltips. */
export const shortSuite = (id: string) => id.split("-").at(-1) ?? id;

/** A share as a percent with at most one decimal: 0.8981 → "89.8%", 1 → "100%". */
export const formatShare = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;

/** A difference of shares in percentage points, unsigned: 0.0019 → "0.2 pts". */
export const formatPoints = (d: number) => `${Math.abs(d * 100).toFixed(1)} pts`;

/** How a measure's value reads on the page: shares as percent, cost in dollars, time in seconds. */
export function formatValue(measure: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (measure === "costPerRunUsd") return `$${v.toFixed(3)}`;
  if (measure === "secondsPerRun") return `${Math.round(v)} s`;
  return formatShare(v);
}

/** Replaces each {{name}} with ctx[name]. Throws on a name ctx lacks, or on an unclosed {{. */
export function fillTemplate(template: string, ctx: Record<string, string>): string {
  const out = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, name: string) => {
    if (!(name in ctx)) throw new Error(`Unknown placeholder {{${name}}} in "${template}"`);
    return ctx[name];
  });
  if (out.includes("{{")) throw new Error(`Unclosed placeholder in "${template}"`);
  return out;
}

type SetupResult = EvalIndex["live"];

/** live.<measure>.<split>, live.runs.<split> and live.suites for one setup result (prefix live/baseline). */
function setupContext(prefix: string, r: SetupResult): Record<string, string> {
  const ctx: Record<string, string> = { [`${prefix}.suites`]: String(r.suite.length) };
  for (const m of new Set([...METRICS, ...SCOREBOARD_MEASURES]))
    for (const sp of SPLITS) ctx[`${prefix}.${m}.${sp}`] = formatValue(m, r[m][sp].value);
  for (const sp of SPLITS) ctx[`${prefix}.runs.${sp}`] = String(r.runCounts[sp].graded);
  return ctx;
}

/** Every placeholder the story may use, as display strings. */
export function storyContext(index: EvalIndex, verdict: Verdict, story: EvalStory): Record<string, string> {
  const measured = index.iterations.filter((i) => i.measured);
  const changes = measured.filter((i) => i.measured?.comparedTo);
  const kept = changes.filter((i) => ["kept", "promoted"].includes(story.iterations[i.id]?.outcome ?? ""));
  const liveCost = index.live.costPerRunUsd.all.value;
  const baseCost = index.baseline.costPerRunUsd.all.value;

  const misses = verdict.targets.flatMap((t) =>
    t.measure !== "beatsBaseline" && (t.status === "near" || t.status === "missed") && t.value?.value != null
      ? [fillTemplate(story.verdict.miss, {
          measure: story.measures[t.measure] ?? t.measure,
          gap: formatPoints(t.min - t.value.value),
          target: formatShare(t.min),
          runs: String(t.value.runs),
        })]
      : [],
  );

  return {
    ...setupContext("live", index.live),
    ...setupContext("baseline", index.baseline),
    "evalSet.companies": String(index.evalSet.companies),
    "evalSet.weeks": String(index.evalSet.weeks.dev + index.evalSet.weeks.test),
    "evalSet.devWeeks": String(index.evalSet.weeks.dev),
    "evalSet.testWeeks": String(index.evalSet.weeks.test),
    "evalSet.evalsets": String(index.evalSet.evalsets),
    "evalSet.relevant": String(index.evalSet.relevant),
    "evalSet.traps": String(index.evalSet.traps),
    "iterations.changes": String(changes.length),
    "iterations.kept": String(kept.length),
    "cost.liveShareOfBaseline": liveCost != null && baseCost ? `${Math.round((liveCost / baseCost) * 100)}%` : "—",
    "verdict.met": String(verdict.met),
    "verdict.total": String(verdict.total),
    "verdict.wins": String(verdict.baseline.wins),
    "verdict.compared": String(verdict.baseline.compared),
    "verdict.misses": misses.length ? misses.join(" ") : story.verdict.allMet,
  };
}

/** The verdict heading: the beats-all wording only when live beats the baseline on every compared measure. */
export function verdictHeading(story: EvalStory, ctx: Record<string, string>, verdict: Verdict): string {
  return fillTemplate(verdict.baseline.beatsAll ? story.verdict.beatsAll : story.verdict.beatsSome, ctx);
}

/**
 * The verbatim excerpt a moved item quotes: the recorded field from `start` up to `before` (or the end),
 * trimmed of trailing spaces and separators. Throws when the field is missing, `start` is absent or appears
 * more than once, or `before` does not follow it — so a reworded record can't silently shift a quote.
 */
export function resolveQuote(record: { decision?: string; notes?: string }, q: Quote): string {
  const text = record[q.from];
  if (typeof text !== "string") throw new Error(`no recorded ${q.from} to quote from`);
  const at = text.indexOf(q.start);
  if (at < 0) throw new Error(`quote start "${q.start}" is not in the recorded ${q.from}`);
  const count = text.split(q.start).length - 1;
  if (count > 1) throw new Error(`quote start "${q.start}" appears ${count} times in the recorded ${q.from}`);
  let end = text.length;
  if (q.before !== undefined) {
    end = text.indexOf(q.before, at + q.start.length);
    if (end < 0) throw new Error(`quote end "${q.before}" does not follow "${q.start}" in the recorded ${q.from}`);
  }
  return text.slice(at, end).replace(/[\s,;:]+$/, "");
}

// ── The Models page (chunk 10) ──

/** The judge panel as config/judges.yaml defines it; the page reads it with judges() (src/lib/config.ts). */
export type JudgePanel = { models: string[]; minAgree: number };

/** How a difference reads: "11.9 pts higher", "$0.056 higher", "3 s lower", "the same", or "not comparable". */
function formatDiff(measure: string, c: { diff: number | null; direction: "higher" | "lower" | "same" | null }): string {
  if (c.diff === null || c.direction === null) return "not comparable";
  if (c.direction === "same") return "the same";
  const size = Math.abs(c.diff);
  const amount = measure === "costPerRunUsd" ? `$${size.toFixed(3)}` : measure === "secondsPerRun" ? `${Math.round(size)} s` : formatPoints(size);
  return `${amount} ${c.direction}`;
}

const runsPhrase = ([a, b]: [number, number]) => (a === b ? `${a} runs each` : `${a} and ${b} runs`);
const listed = (xs: string[]) => [...new Set(xs)].join(" and ");

/**
 * Every placeholder the Models page's prose may use. The comparison keys (models.pair.*, models.<measure>.*,
 * models.lowest.*, models.suite) come from the first suite with a like-for-like pair, and are absent when no suite
 * has one, so a sentence that needs them fails loudly in fillTemplate rather than printing a made-up comparison.
 */
export function modelsContext(index: EvalIndex, judges: JudgePanel, story: EvalStory, cmp: ModelComparisons = modelComparisons(index)): Record<string, string> {
  const promptOf = (p: string | null) => p ?? "default";
  const ctx: Record<string, string> = {
    ...Object.fromEntries(Object.entries(story.measures).map(([m, label]) => [`measures.${m}`, label])),
    "models.live": cmp.live.modelLabel,
    "models.liveSetup": cmp.live.setup,
    "models.livePromptSet": promptOf(cmp.live.promptSet),
    "models.livePromptSetModels": listed(index.setups.filter((s) => promptOf(s.promptSet) === promptOf(cmp.live.promptSet)).map((s) => s.modelLabel)),
    "models.priceCheckedOn": index.priceParity.checkedOn,
    "judges.count": String(judges.models.length),
    "judges.minAgree": String(judges.minAgree),
  };
  const group = cmp.groups.find((g) => likeForLike(g).length);
  if (!group) return ctx;
  const [{ live, other }] = likeForLike(group);
  const c = compareRows(live.result, other.result);
  for (const m of COMPARED) {
    ctx[`models.${m}.live`] = formatValue(m, c[m].a);
    ctx[`models.${m}.other`] = formatValue(m, c[m].b);
    ctx[`models.${m}.diff`] = formatDiff(m, c[m]);
    ctx[`models.${m}.runs`] = runsPhrase(c[m].runs);
  }
  const low = lowestRecall(group);
  return {
    ...ctx,
    "models.suite": shortSuite(group.suite),
    "models.suiteWeeks": String(group.weeks.length),
    "models.suiteEvalsets": String(group.evalsets),
    "models.other": other.modelLabel,
    "models.otherPromptSets": listed(index.setups.filter((s) => s.model === other.model).map((s) => promptOf(s.promptSet))),
    "models.pair.live": live.setup,
    "models.pair.other": other.setup,
    "models.pair.method": live.method,
    "models.pair.promptSet": promptOf(live.promptSet),
    "models.pipeline.count": String(group.rows.filter(isPipeline).length),
    "models.lowest.setups": listed(low.lowest.map((r) => r.setup)),
    "models.lowest.recall": listed(low.lowest.map((r) => formatValue("recall", r.result.recall.all.value))),
    "models.lowest.runs": listed(low.lowest.map((r) => `${r.result.recall.all.runs} runs`)),
    "models.lowest.count": String(low.lowest.length),
    "models.otherVendor.count": String(low.otherVendor.length),
  };
}

/** The Models page's prose, filled. Throws (via fillTemplate) on a placeholder the data cannot fill. */
export function modelsStory(index: EvalIndex, judges: JudgePanel, story: EvalStory, cmp: ModelComparisons = modelComparisons(index)) {
  const ctx = modelsContext(index, judges, story, cmp);
  const m = story.models;
  const fill = (t: string) => fillTemplate(t, ctx);
  const group = cmp.groups.find((g) => likeForLike(g).length);
  const keyBias = group && lowestRecall(group).onlyOtherVendor ? m.caveats.keyBias.holds : m.caveats.keyBias.otherwise;
  return {
    heading: fill(m.why.heading),
    intro: fill(m.why.intro),
    points: m.why.points.map(fill),
    closing: fill(m.why.closing),
    caveats: [fill(keyBias), fill(m.caveats.priceParity), fill(m.caveats.tuning), fill(m.caveats.oneSuite)],
    judges: fill(m.judges),
    liveRule: fill(m.liveRule),
  };
}
