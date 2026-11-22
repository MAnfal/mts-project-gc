import { z } from "zod";

export const MIN_SECONDS = 1;
export const MAX_SECONDS = 120;
export const DEFAULT_SECONDS = 5;

// Any finite number is accepted and clamped; anything else falls back to the default. zod 4's
// number() already rejects NaN and ±Infinity (e.g. "1e999"), so no separate finiteness check is needed.
const SecondsParam = z.coerce
  .number()
  .transform((n) => Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.floor(n))));

/** `?seconds=` for the probe: whole seconds, clamped to 1–120, default 5 when missing or not a number. */
export function parseSeconds(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_SECONDS;
  const parsed = SecondsParam.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SECONDS;
}
