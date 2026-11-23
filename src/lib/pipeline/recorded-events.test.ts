import { describe, expect, it } from "vitest";
import { frozenWeek } from "../config";
import { shippedJson, shippedRuns, shippedSuiteIds } from "../evals/__fixtures__/shipped";
import { recordedView } from "../runs/recorded-view";
import { reduceEvents } from "../runs/reduce";
import { recordedEvents, reviewerLabel } from "./recorded-events";
import { projectRecordedRun } from "./recorded";

// The one recorded-run → RunEvent mapping, shared by the GC's examples (recorded.ts, strict labels, assertPublic) and
// the reviewer's run report (reviewerLabel: internal stage ids allowed). Every shipped run goes through it.
type Rec = { id: string; status: string; error?: string; items?: { document_number: string; tier: string }[]; config: { windowStart: string; windowEnd: string } };

const all = (): Rec[] => [
  ...shippedSuiteIds().flatMap((s) => shippedRuns<Rec>(s)),
  ...shippedJson<{ runId: string }[]>("user-view/runs-index.json").map((r) => shippedJson<Rec>(`user-view/runs/${r.runId}.json`)),
];
const docsOf = (r: Rec) => frozenWeek(r.config.windowStart, r.config.windowEnd) ?? [];

describe("recordedEvents for the reviewer, over every shipped run", () => {
  it("renders each finished run as a done report with its recorded items and tiers, and each failed run with its error", () => {
    const runs = all();
    expect(runs).toHaveLength(439 + 22);
    for (const raw of runs) {
      const v = recordedView(raw);
      const view = reduceEvents(recordedEvents(raw, v, docsOf(raw), (s) => reviewerLabel(s, v.company)));
      if (raw.status === "done") {
        expect(view.status).toBe("done");
        expect(view.items.map((i) => [i.document_number, i.tier])).toEqual((raw.items ?? []).map((i) => [i.document_number, i.tier]));
      } else {
        expect(view.status).toBe("failed");
        expect(view.failure?.message).toBe(raw.error);
        expect(view.steps.length).toBeGreaterThan(0);
        expect(view.steps.every((s) => s.state === "done")).toBe(true);
      }
    }
  });

  it("gives the closest calls the GC's example shows, from the same function", () => {
    const raw = shippedJson<Rec>("user-view/runs/2026-11-21T19-22-35-758Z_pipeline_t6m4.json");
    const v = recordedView(raw);
    const reviewer = reduceEvents(recordedEvents(raw, v, docsOf(raw), (s) => reviewerLabel(s, v.company)));
    const gc = reduceEvents(projectRecordedRun(raw).events);
    expect(reviewer.screenedOut).toEqual(gc.screenedOut);
    expect(reviewer.screenedOut.length).toBeGreaterThan(3);
    expect(reviewer.notReviewedCount).toBe(gc.notReviewedCount);
  });
});

describe("reviewerLabel", () => {
  it("shows the public label with the internal stage id beside it", () => {
    expect(reviewerLabel("filter:llm", "Ledgerly Inc.")).toEqual({ step: "screen", label: "Screened them against Ledgerly Inc.'s profile (filter:llm)" });
  });

  it("keeps a stage that has no public label (the baseline's) under its own id, instead of throwing", () => {
    expect(reviewerLabel("baseline:format", "X")).toEqual({ step: "baseline:format", label: "baseline:format" });
  });
});
