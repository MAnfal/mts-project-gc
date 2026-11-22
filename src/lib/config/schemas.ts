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
