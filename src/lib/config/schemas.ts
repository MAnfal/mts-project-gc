import { z } from "zod";

/** config/app.yaml — app-wide settings. Later chunks add their files' schemas beside this one. */
export const AppConfigSchema = z.object({
  appName: z.string().min(1),
  maxWindowDays: z.number().int().positive(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

const share = z.number().min(0).max(1);

/**
 * config/app.yaml → evalTargets: the RFC's success targets, graded against the live setup on all weeks by
 * src/lib/evals/verdict.ts. Each measure is a minimum share; `nearMiss` is how far below a target still
 * shows yellow rather than red. `beatsBaseline` adds "beats the single-prompt baseline" as a target.
 */
export const EvalTargetsSchema = z
  .object({
    recall: share,
    precision: share,
    datesRight: share,
    tierAgreement: share,
    relevanceAgreement: share,
    beatsBaseline: z.boolean(),
    nearMiss: share,
  })
  .strict();
export type EvalTargets = z.infer<typeof EvalTargetsSchema>;

/** The slice of config/app.yaml the eval view reads. */
export const EvalAppConfigSchema = z.object({ evalTargets: EvalTargetsSchema });

/** config/app.yaml → defaultPreset: the preset the new-run screen opens on, and whose general counsel the sidebar shows. */
export const NewRunConfigSchema = z.object({ defaultPreset: z.string().min(1) });

/**
 * config/app.yaml → suggestAreas: "Suggest from description" on the new-run screen (one model call, server-side only).
 * UI-only, so it lives in app.yaml: prompts.yaml and experiment.yaml are on the decision path and stay as the POC's.
 * The prompt must use {{description}}, or the model would be asked about no company at all.
 */
export const SuggestAreasConfigSchema = z.object({
  suggestAreas: z.object({
    model: z.string().min(1),
    prompt: z.string().refine((s) => s.includes("{{description}}"), "prompt must contain the {{description}} placeholder"),
  }),
});
export type SuggestAreasConfig = z.infer<typeof SuggestAreasConfigSchema>["suggestAreas"];

const count = z.number().int().positive();

/**
 * config/app.yaml → followUp: the follow-up chat under a finished report (one streamed model call, server-side only).
 * UI-only, so it lives in app.yaml, never in a decision-path file. The system prompt must use {{report}}, or the model
 * would answer about no report at all. The caps bound what one question can send and spend; /api/followup enforces them.
 */
export const FollowUpConfigSchema = z.object({
  followUp: z
    .object({
      model: z.string().min(1),
      system: z.string().refine((s) => s.includes("{{report}}"), "system must contain the {{report}} placeholder"),
      suggestions: z.array(z.string().min(1)),
      maxTurns: count,
      maxMessageChars: count,
      maxContextChars: count,
      maxAnswerTokens: count,
    })
    .strict(),
});
export type FollowUpConfig = z.infer<typeof FollowUpConfigSchema>["followUp"];

/** The slice the GC pages read: the suggestion chips only, never the model or the prompt. */
export const FollowUpSuggestionsSchema = z.object({ followUp: z.object({ suggestions: z.array(z.string().min(1)) }) });
