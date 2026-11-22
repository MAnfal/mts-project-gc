import { METRICS, SPLITS, type EvalIndex } from "./index-schema";
import type { EvalStory, Quote } from "./story-schema";
import { SCOREBOARD_MEASURES, type Verdict } from "./verdict";

/**
 * Fills config/eval-story.yaml's {{placeholders}} from index.json, so the prose can be reworded freely while
 * every number in it stays the recorded one. Pure and client-safe.
 */

/** A share as a percent with at most one decimal: 0.8981 → "89.8%", 1 → "100%". */
/** "06-passages" → "06": the iteration's number, shown before its label. */
export const iterationNumber = (id: string) => id.split("-")[0];

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
