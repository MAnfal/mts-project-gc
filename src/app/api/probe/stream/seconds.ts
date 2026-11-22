import { z } from "zod";

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 120;
export const DEFAULT_SECONDS = 5;

// Any number is accepted and clamped; anything that isn't a finite number falls back to the default.
const SecondsParam = z.coerce
  .number()
  .refine(Number.isFinite)
  .transform((n) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.floor(n))));

/** `?seconds=` for the probe: whole seconds, clamped to 1–120, default 5 when missing or not a number. */
export function parseSeconds(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_SECONDS;
  const parsed = SecondsParam.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SECONDS;
}
