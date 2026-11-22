import { z } from "zod";
import { METRICS } from "./index-schema";
import { SCOREBOARD_MEASURES } from "./verdict";

/**
 * Contract for config/eval-story.yaml: the eval view's prose, which the user owns and can reword without
 * touching code. It holds no typed numbers. A number reaches the page only as a {{placeholder}} filled from
 * public/evals/index.json (src/lib/evals/story.ts), or inside a quote resolved verbatim from an iteration's
 * recorded decision or notes. Client-safe: the page reads the file on the server with readYaml and passes the
 * parsed value down.
 */

/** Prose with no digit outside {{placeholders}}, so no metric can be typed into the YAML and drift from the data. */
export const Prose = z
  .string()
  .min(1)
  .refine((s) => !/\d/.test(s.replace(/\{\{[^}]*\}\}/g, "")), {
    message: "has a typed number; use a {{placeholder}} filled from index.json, or a quote from the record",
  });

export const OUTCOMES = ["reference", "kept", "promoted", "rejected", "not promoted", "next"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export const MOVED_TAGS = ["fixed", "better", "worse"] as const;

/**
 * A verbatim excerpt of the iteration's recorded `decision` or `notes`: from the first character of `start`
 * up to (not including) `before`, or to the end. Both anchors are number-free; story.ts resolves them and
 * throws when `start` is missing or ambiguous.
 */
export const QuoteSchema = z.object({ from: z.enum(["decision", "notes"]), start: Prose, before: Prose.optional() }).strict();
export type Quote = z.infer<typeof QuoteSchema>;

export const MovedSchema = z.object({ tag: z.enum(MOVED_TAGS), text: Prose, quote: QuoteSchema.optional() }).strict();
export type Moved = z.infer<typeof MovedSchema>;

export const IterationStorySchema = z.object({ label: Prose, outcome: z.enum(OUTCOMES), moved: z.array(MovedSchema) }).strict();
export type IterationStory = z.infer<typeof IterationStorySchema>;

/** Where a CARL row's one link goes: the cases view, the iteration log, the scoreboard, or the live iteration. */
export const CARL_LINKS = ["cases", "iterations", "scoreboard", "live-iteration"] as const;
const CarlRowSchema = z.object({ text: Prose, link: z.enum(CARL_LINKS), linkLabel: Prose }).strict();

/** Every measure the page names: the scoreboard's rows and suiteReport's metrics. */
const LABELLED_MEASURES = [...new Set([...SCOREBOARD_MEASURES, ...METRICS])] as [string, ...string[]];

export const EvalStorySchema = z
  .object({
    page: z.object({ title: Prose, description: Prose }).strict(),
    verdict: z
      .object({
        /** Heading when live beats the baseline on every compared measure. */
        beatsAll: Prose,
        /** Heading otherwise. */
        beatsSome: Prose,
        /** Sub-line under the heading. */
        sub: Prose,
        /** One sentence per target missed or nearly missed; fills {{measure}}, {{gap}}, {{target}}, {{runs}}. */
        miss: Prose,
        /** Stands in for the misses when every target is met. */
        allMet: Prose,
      })
      .strict(),
    carl: z.object({ context: CarlRowSchema, action: CarlRowSchema, result: CarlRowSchema, learning: CarlRowSchema }).strict(),
    /** zod 4: a record keyed by an enum requires every key. */
    measures: z.record(z.enum(LABELLED_MEASURES), Prose),
    /** Keyed by iteration id (public/evals/iterations/<id>). */
    iterations: z.record(z.string().regex(/^\d{2}-[a-z0-9-]+$/), IterationStorySchema),
  })
  .strict();
export type EvalStory = z.infer<typeof EvalStorySchema>;
