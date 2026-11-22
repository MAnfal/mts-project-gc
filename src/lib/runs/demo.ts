import type { RunRequest } from "./types";

/** Until the new-run screen exists, / starts this one run: the Ledgerly preset on the frozen week Nov 2–6, 2026. */
export const DEMO_RUN = { profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" } satisfies RunRequest;
