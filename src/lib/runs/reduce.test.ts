import { beforeAll, describe, expect, it } from "vitest";
import { runReplay } from "../pipeline/__fixtures__/replay";
import type { RunEvent, StepKey } from "../pipeline/events";
import { reduceEvents, stepStatusText } from "./reduce";

// The real public events of a recorded run of the live setup (Brightside, 2026-11-02..06), replayed through the ported
// pipeline at no cost. Constructed sequences below cover what that run never did: retries and failures.
let events: RunEvent[];
beforeAll(async () => {
  events = (await runReplay()).events;
}, 60_000);

const TIMEOUT = "No response after 3 tries. Retry starts the run again from the beginning, with the same settings.";

const startEvent = (steps: StepKey[]): RunEvent => ({
  type: "run.start",
  company: "Ledgerly Inc.",
  windowStart: "2026-11-02",
  windowEnd: "2026-11-06",
  asOf: "2026-11-06",
  steps: steps.map((step) => ({ step, label: `Label ${step}` })),
});

describe("reduceEvents on a recorded run", () => {
  it("marks every step in run.start.steps done, in order, with the count and time step.done reported", () => {
    const view = reduceEvents(events);
    const start = events[0];
    if (start.type !== "run.start") throw new Error("fixture does not open with run.start");
    expect(view.steps.map((s) => s.step)).toEqual(start.steps.map((s) => s.step));
    expect(view.steps.map((s) => s.label)).toEqual(start.steps.map((s) => s.label));
    const doneEvents = events.filter((e) => e.type === "step.done");
    expect(view.steps.map((s) => s.state)).toEqual(start.steps.map(() => "done"));
    expect(view.steps.map((s) => [s.count, s.ms])).toEqual(doneEvents.map((e) => (e.type === "step.done" ? [e.count, e.ms] : null)));
  });

  it("keeps everything run.done carries", () => {
    const view = reduceEvents(events);
    const done = events.at(-1);
    if (done?.type !== "run.done") throw new Error("fixture does not end with run.done");
    expect(view.status).toBe("done");
    expect(view.failure).toBeNull();
    expect(view.failedStep).toBeNull();
    expect(view.items).toEqual(done.items);
    expect(view.items).toHaveLength(3);
    expect(view.dropped).toEqual(done.dropped);
    expect(view.screenedOut).toEqual(done.screenedOut);
    expect(view.screenedOut).toHaveLength(56);
    expect(view.notReviewedCount).toBe(407);
    expect(view.scanned).toBe(466);
    expect(view.markdown).toBe(done.markdown);
    expect(view.ms).toBe(done.ms);
    expect(view.company).toBe("Brightside Foods Co.");
    expect([view.windowStart, view.windowEnd, view.asOf]).toEqual(["2026-11-02", "2026-11-06", "2026-11-06"]);
  });

  it("shows the step in progress with its sub-items so far, and the steps after it as waiting", () => {
    const progress = events.flatMap((e, i) => (e.type === "step.progress" ? [i] : []));
    expect(progress).toHaveLength(20);
    const cut = events.slice(0, progress[11] + 1); // stream so far: 12 passages read
    const view = reduceEvents(cut);
    expect(view.status).toBe("running");
    const read = view.steps.find((s) => s.step === "read")!;
    expect(read.state).toBe("running");
    expect(read.progress).toHaveLength(12);
    const last = events[progress[11]];
    if (last.type !== "step.progress") throw new Error("not a progress event");
    expect(read.progress.at(-1)).toEqual({ count: last.count, title: last.title });
    expect(read.count).toBeNull();
    expect(view.steps.map((s) => s.state)).toEqual(["done", "done", "running", "waiting", "waiting", "waiting"]);
    expect(view.items).toEqual([]);
  });

  it("lists items as item.confirmed arrives, before run.done", () => {
    const firstDone = events.findIndex((e) => e.type === "step.done" && e.step === "verify");
    const view = reduceEvents(events.slice(0, firstDone));
    expect(view.confirmed.map((i) => i.document_number)).toEqual(
      events.flatMap((e) => (e.type === "item.confirmed" ? [e.item.document_number] : [])),
    );
    expect(view.confirmed).toHaveLength(3);
    expect(view.items).toEqual([]);
  });
});

describe("reduceEvents on constructed failures", () => {
  const head: RunEvent[] = [
    startEvent(["scan", "rank", "screen"]),
    { type: "step.start", step: "scan", label: "Label scan" },
    { type: "step.done", step: "scan", count: 466, ms: 2100 },
    { type: "step.start", step: "rank", label: "Label rank" },
    { type: "step.retry", step: "rank", attempt: 2, delayMs: 2000 },
    { type: "step.retry", step: "rank", attempt: 3, delayMs: 4000 },
  ];

  it("tracks the latest retry on the running step", () => {
    const view = reduceEvents(head);
    const rank = view.steps.find((s) => s.step === "rank")!;
    expect(rank.state).toBe("running");
    expect(rank.retry).toEqual({ attempt: 3, delayMs: 4000 });
    expect(view.status).toBe("running");
  });

  it("keeps which step failed and its message, so Retry can show under it", () => {
    const view = reduceEvents([
      ...head,
      { type: "step.failed", step: "rank", label: "Label rank", message: TIMEOUT },
      { type: "run.failed", step: "rank", message: TIMEOUT },
    ]);
    expect(view.status).toBe("failed");
    expect(view.failedStep).toBe("rank");
    expect(view.failure).toEqual({ step: "rank", message: TIMEOUT });
    const rank = view.steps.find((s) => s.step === "rank")!;
    expect(rank).toMatchObject({ state: "failed", message: TIMEOUT, retry: null });
    expect(view.steps.map((s) => s.state)).toEqual(["done", "failed", "waiting"]);
  });

  it("marks the failed step from run.failed alone, when no step.failed preceded it", () => {
    const view = reduceEvents([...head, { type: "run.failed", step: "rank", message: TIMEOUT }]);
    expect(view.steps.find((s) => s.step === "rank")).toMatchObject({ state: "failed", message: TIMEOUT });
  });

  it("keeps a run-level failure (step null) apart from the steps, and stops the step that was running", () => {
    const msg = "Something went wrong in this step. Retry starts the run again from the beginning, with the same settings.";
    const view = reduceEvents([...head, { type: "run.failed", step: null, message: msg }]);
    expect(view.status).toBe("failed");
    expect(view.failedStep).toBeNull();
    expect(view.failure).toEqual({ step: null, message: msg });
    expect(view.steps.map((s) => s.state)).toEqual(["done", "failed", "waiting"]);
    expect(view.steps.find((s) => s.step === "rank")?.message).toBeNull();
  });

  it("fails before any step when run.failed is the only event", () => {
    const view = reduceEvents([{ type: "run.failed", step: null, message: "x" }]);
    expect(view).toMatchObject({ status: "failed", steps: [], company: null, failure: { step: null, message: "x" } });
  });

  it("adds a step that run.start did not list instead of dropping its events", () => {
    const view = reduceEvents([
      startEvent(["scan"]),
      { type: "step.start", step: "write", label: "Wrote an action" },
      { type: "step.done", step: "write", count: 2, ms: 900 },
    ]);
    expect(view.steps.map((s) => [s.step, s.state, s.count])).toEqual([
      ["scan", "waiting", null],
      ["write", "done", 2],
    ]);
  });

  it("starts empty with no events", () => {
    expect(reduceEvents([])).toMatchObject({ status: "running", steps: [], items: [], confirmed: [], failure: null });
  });
});

describe("stepStatusText", () => {
  it("names each state for screen readers", () => {
    expect(stepStatusText("done", true)).toBe("done");
    expect(stepStatusText("waiting", true)).toBe("waiting");
    expect(stepStatusText("failed", false)).toBe("failed");
    expect(stepStatusText("running", true)).toBe("in progress");
  });

  it("says a step cut off by an interrupted stream stopped, not that it is in progress", () => {
    expect(stepStatusText("running", false)).toBe("stopped");
  });
});
