import { AsyncLocalStorage } from "node:async_hooks";

export interface RetryPolicy {
  attempts: number;
  delaysMs: number[];
}

export const RETRY: RetryPolicy = {
  // At most 3 tries per external call: the GC's rule for when a step counts as failed.
  attempts: 3,
  // 2 s then 4 s: long enough to ride out a brief provider or network blip, and at most 6 s per call, so the
  // slowest recorded run (87 s) stays far inside the 300 s function limit.
  delaysMs: [2000, 4000],
};

/** `attempt` is the try about to start (2 or 3); `delayMs` is the wait before it. */
export type OnRetry = (r: { attempt: number; delayMs: number; error: unknown }) => void;

/** Every try of one call failed. `cause` is the last error. */
export class RetriesExhausted extends Error {
  constructor(
    readonly attempts: number,
    cause: unknown,
  ) {
    super(`${attempts} attempts failed: ${(cause as Error)?.message ?? String(cause)}`, { cause });
    this.name = "RetriesExhausted";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls `fn` up to `policy.attempts` times, waiting `policy.delaysMs[i]` before try i + 2. Each try re-issues the
 * same request: `fn` takes no arguments, so a retry can never change what is asked. `stopped` lets the caller cut
 * the remaining tries short (the run already failed elsewhere); the last error is then reported as exhausted.
 */
export async function withRetry<T>(fn: () => Promise<T>, policy: RetryPolicy = RETRY, onRetry: OnRetry = () => {}, stopped: () => boolean = () => false): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= policy.attempts || stopped()) throw new RetriesExhausted(attempt, error);
      const delayMs = policy.delaysMs[attempt - 1] ?? policy.delaysMs.at(-1) ?? 0;
      onRetry({ attempt: attempt + 1, delayMs, error });
      await sleep(delayMs);
    }
  }
}

// The run that is making a call, for code that can't be handed a callback (the Federal Register client is called
// from deep inside stages). Scoped per async context, so concurrent runs in one server process never mix.
const scope = new AsyncLocalStorage<{ onRetry: OnRetry; stopped: () => boolean }>();

export const withRetryScope = <T>(s: { onRetry: OnRetry; stopped: () => boolean }, fn: () => Promise<T>) => scope.run(s, fn);

/** withRetry, reporting to the run in scope (if any). */
export const withScopedRetry = <T>(fn: () => Promise<T>) => {
  const s = scope.getStore();
  return withRetry(fn, RETRY, s?.onRetry, s?.stopped);
};
