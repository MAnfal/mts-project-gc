import { z } from "zod";

/** config/app.yaml — app-wide settings. Later chunks add their files' schemas beside this one. */
export const AppConfigSchema = z.object({
  appName: z.string().min(1),
  maxWindowDays: z.number().int().positive(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
