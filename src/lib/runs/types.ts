// Shapes a live run has in the browser. Client-safe: types only, so nothing here pulls server code (config, fs)
// or the pipeline's internal stage names into the bundle.
import type { RunEvent } from "../pipeline/events";
import type { CompanyProfile } from "../types";

/** What the browser POSTs to /api/run, and what Retry re-posts unchanged. */
export type RunRequest =
  | { profileId: string; windowStart: string; windowEnd: string }
  | { customProfile: CompanyProfile; windowStart: string; windowEnd: string };

export type RunDone = Extract<RunEvent, { type: "run.done" }>;

/**
 * running: the stream is open in this tab. interrupted: it ended without run.done or run.failed (dropped connection,
 * server timeout, refused request, or the page reloaded mid-run), so the run can only be retried, never resumed.
 */
export type RunStatus = "running" | "done" | "failed" | "interrupted";

/**
 * One run as saved in IndexedDB. Holds only what the browser was sent: never the server's RunConfig or the
 * pipeline's decisions, which carry model ids and internal scores.
 */
export interface StoredRun {
  id: string;
  createdAt: string;
  request: RunRequest;
  events: RunEvent[];
  status: RunStatus;
  /** The run.done event, once it arrives. */
  result: RunDone | null;
  /** The profile the run used, as it was when the run started (a preset or the GC's own). */
  profile: CompanyProfile;
}
