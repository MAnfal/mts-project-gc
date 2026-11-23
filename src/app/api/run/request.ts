import "server-only";
import { format, isValid, parseISO } from "date-fns";
import { z } from "zod";
import { CompanySchema } from "@/lib/config";
import type { RunRequest } from "@/lib/runs/types";
import { validateWindow } from "@/lib/runs/weeks";

// Validates the body of POST /api/run before anything runs. Messages are plain sentences for the GC: no field
// paths from the schema library, no config file names, no stack.

/** A real calendar date written YYYY-MM-DD (so 2026-02-30 and 2026-13-01 fail). */
const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => isValid(parseISO(s)) && format(parseISO(s), "yyyy-MM-dd") === s);

const Body = z.object({
  profileId: z.string().optional(),
  customProfile: z.unknown().optional(),
  windowStart: IsoDate,
  windowEnd: IsoDate,
});

export type Parsed = { ok: true; request: RunRequest } | { ok: false; message: string };

const fail = (message: string): Parsed => ({ ok: false, message });

export function parseRunRequest(body: unknown, limits: { maxWindowDays: number; presetIds: string[] }): Parsed {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail("Send a JSON object with a profile and a window.");
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "profileId")) return fail("Unknown company profile. Pick one of the presets or send your own profile.");
    return fail("Dates must be real calendar dates written YYYY-MM-DD.");
  }
  const { profileId, customProfile, windowStart, windowEnd } = parsed.data;

  // The new-run screen runs the same check (and the same inclusive day count) before it enables Run.
  const windowError = validateWindow(windowStart, windowEnd, limits.maxWindowDays);
  if (windowError) return fail(windowError);

  if (profileId !== undefined && customProfile !== undefined) return fail("Send either a preset profileId or a customProfile, not both.");
  if (profileId !== undefined) {
    // Presets only: an eval company exists in config but is never offered, so it is as unknown as a typo.
    if (!limits.presetIds.includes(profileId)) return fail("Unknown company profile. Pick one of the presets or send your own profile.");
    return { ok: true, request: { profileId, windowStart, windowEnd } };
  }
  if (customProfile === undefined) return fail("Send either a preset profileId or a customProfile.");
  const profile = CompanySchema.safeParse(customProfile);
  if (!profile.success) return fail(`The company profile is incomplete or malformed: ${profile.error.issues[0].path.join(".") || "it must be an object"}.`);
  return { ok: true, request: { customProfile: profile.data, windowStart, windowEnd } };
}
