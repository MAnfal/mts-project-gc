import { describe, expect, it, vi } from "vitest";
import { UNEXPECTED_MESSAGE, type RunEvent } from "@/lib/pipeline/events";
import { RunFailed } from "@/lib/pipeline/run";
import { runToStream } from "./stream";

const start: RunEvent = { type: "run.start", company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06", steps: [] };
const done: RunEvent = { type: "run.done", items: [], dropped: [], screenedOut: [], notReviewedCount: 0, scanned: 1, markdown: "", ms: 5 };
const failed: RunEvent = { type: "run.failed", step: "scan", message: "No response after 3 tries." };

const lines = async (stream: ReadableStream<Uint8Array>) =>
  (await new Response(stream).text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunEvent);

const quiet = () => vi.fn();

describe("runToStream", () => {
  it("writes each emitted event as one JSON line, in order, then closes", async () => {
    const stream = runToStream(async (emit) => {
      emit(start);
      await Promise.resolve();
      emit(done);
    }, quiet());
    const text = await new Response(stream).text();
    expect(text).toBe(`${JSON.stringify(start)}\n${JSON.stringify(done)}\n`);
  });

  it("adds nothing when the run fails with RunFailed: the pipeline already sent run.failed", async () => {
    const log = quiet();
    const got = await lines(
      runToStream(async (emit) => {
        emit(start);
        emit(failed);
        throw new RunFailed(new Error("boom"));
      }, log),
    );
    expect(got).toEqual([start, failed]);
    expect(log).not.toHaveBeenCalled();
  });

  it("turns an error thrown outside the pipeline into one run.failed with no step, and logs it server-side", async () => {
    const log = quiet();
    const got = await lines(
      runToStream(() => {
        throw new Error('experiment.yaml userView.setup "x" is not a setup'); // e.g. building the config, before runPipeline
      }, log),
    );
    expect(got).toEqual([{ type: "run.failed", step: null, message: UNEXPECTED_MESSAGE }]);
    expect(log).toHaveBeenCalledOnce();
  });

  it("never sends a second terminal event", async () => {
    const afterDone = await lines(
      runToStream(async (emit) => {
        emit(start);
        emit(done);
        throw new Error("thrown after run.done");
      }, quiet()),
    );
    expect(afterDone).toEqual([start, done]);
    const afterFailed = await lines(
      runToStream(async (emit) => {
        emit(failed);
        throw new Error("not a RunFailed");
      }, quiet()),
    );
    expect(afterFailed).toEqual([failed]);
  });

  it("emitting after the client disconnects is a no-op, never a throw back into the pipeline", async () => {
    let emit!: (e: RunEvent) => void;
    let finish!: () => void;
    const stream = runToStream(
      (e) =>
        new Promise<void>((resolve) => {
          emit = e;
          finish = resolve;
        }),
      quiet(),
    );
    const reader = stream.getReader();
    await new Promise((r) => setTimeout(r, 0)); // the run starts on the next microtask
    emit(start);
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    expect(() => emit(done)).not.toThrow();
    finish();
    await new Promise((r) => setTimeout(r, 0));
  });

  it("a run that rejects after the client disconnects doesn't throw either", async () => {
    let fail!: (e: unknown) => void;
    const log = quiet();
    const stream = runToStream((emit) => {
      emit(start);
      return new Promise((_, reject) => (fail = reject));
    }, log);
    await stream.getReader().cancel();
    fail(new Error("late"));
    await new Promise((r) => setTimeout(r, 0));
    expect(log).toHaveBeenCalledOnce();
  });
});
