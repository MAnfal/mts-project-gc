import "server-only";
import { UNEXPECTED_MESSAGE, type RunEvent } from "@/lib/pipeline/events";
import { RunFailed } from "@/lib/pipeline/run";

const TERMINAL = new Set<RunEvent["type"]>(["run.done", "run.failed"]);

/**
 * Streams a run's public events as NDJSON (one JSON event per line), ending with exactly one run.done or run.failed.
 *
 * - runPipeline sends its own terminal event and rejects with RunFailed after run.failed: nothing is added then.
 * - Anything else thrown (building the config, before runPipeline starts) becomes one run.failed with no step and
 *   a fixed message; the error itself goes only to the server log. Never a second terminal event.
 * - After the client disconnects, emit is a no-op: an enqueue on a cancelled stream would throw back into the
 *   pipeline and turn a closed tab into a failed run.
 *
 * Known limit: the pipeline has no AbortSignal, so a run keeps going (and spending) after the client disconnects.
 */
export function runToStream(run: (emit: (e: RunEvent) => void) => unknown, log: (...args: unknown[]) => void = console.error): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let open = true;
  let ended = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (e: RunEvent) => {
        if (!open || ended) return;
        if (TERMINAL.has(e.type)) ended = true;
        controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
      };
      const close = () => {
        if (!open) return;
        open = false;
        controller.close();
      };
      Promise.resolve()
        .then(() => run(emit))
        .catch((e: unknown) => {
          if (e instanceof RunFailed) return;
          log("[Pipeline] run failed outside the pipeline:", e);
          emit({ type: "run.failed", step: null, message: UNEXPECTED_MESSAGE });
        })
        .finally(close);
    },
    cancel() {
      open = false;
    },
  });
}
