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
