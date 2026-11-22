import { describe, expect, it } from "vitest";
import { shippedJson } from "../evals/__fixtures__/shipped";
import { reduceEvents } from "../runs/reduce";
import { assertPublic, type RunEvent } from "./events";
import { exampleIndex, projectRecordedRun } from "./recorded";
import { NEUTRAL_REASON } from "./stages";

// Real example runs from the shipped bundle (public/evals/user-view/runs). No shipped record carries the POC's
// leaked "Jev p=… (no LLM reason)" reason or a dropped item (grep -l "Jev p=" public/evals/user-view/runs/* finds
// none), so those cases use constructed copies of a real record, and each test says so.

type Rec = Record<string, unknown> & { id: string; items: Record<string, unknown>[]; decisions: { document_number: string; jevProbability?: number; llm?: { relevant: boolean; reason: string } }[] };
const ids = () => shippedJson<{ runId: string; status: string }[]>("user-view/runs-index.json");
const record = (suffix: string) => shippedJson<Rec>(`user-view/runs/${ids().find((r) => r.runId.endsWith(suffix))!.runId}.json`);

const doneOf = (events: RunEvent[]) => {
  const e = events.at(-1);
  if (e?.type !== "run.done") throw new Error("projection does not end with run.done");
  return e;
};

describe("projectRecordedRun on a real example run (Ledgerly, Nov 2–6)", () => {
  const rec = record("t6m4");
  const ex = projectRecordedRun(rec);

  it("emits only public events, each passing assertPublic", () => {
    for (const e of ex.events) expect(() => assertPublic(e)).not.toThrow();
    expect(JSON.stringify(ex)).not.toMatch(/filter:|jevProbability|claude-|anthropic\//);
  });

  it("keeps items, tiers, owners and dates equal to the record", () => {
    const done = doneOf(ex.events);
    expect(done.items).toEqual(rec.items);
    expect(reduceEvents(ex.events).items.map((i) => [i.document_number, i.tier, i.owner.email, i.deadline?.date])).toEqual(
      rec.items.map((i) => [i.document_number, i.tier, (i.owner as { email: string }).email, (i.deadline as { date: string } | null)?.date]),
    );
  });

  it("renders as a finished report with every step done, under public labels", () => {
    const view = reduceEvents(ex.events);
    expect(view.status).toBe("done");
    expect(view.company).toBe("Ledgerly Inc.");
    expect(view.steps.map((s) => [s.step, s.state, s.count])).toEqual([
      ["scan", "done", 466],
      ["rank", "done", 23],
      ["screen", "done", 3],
      ["verify", "done", 3],
      ["write", "done", 3],
    ]);
    expect(view.steps[1].label).toBe("Ranked them by relevance to Ledgerly Inc.");
    expect(view.scanned).toBe(466);
  });

  it("lists every document the LLM filter rejected, most relevant first, titled from the frozen week", () => {
    const view = reduceEvents(ex.events);
    const rejected = rec.decisions.filter((d) => d.llm && !d.llm.relevant).sort((a, b) => (b.jevProbability ?? 0) - (a.jevProbability ?? 0));
    expect(view.screenedOut.map((d) => d.document_number)).toEqual(rejected.map((d) => d.document_number));
    expect(view.screenedOut[0].reason).toBe(rejected[0].llm!.reason);
    expect(view.screenedOut[0].title).not.toBe(view.screenedOut[0].document_number);
    // Sent to the filter: the documents at or above the run's relevance cut (23); the rest were never read closely.
    expect(view.notReviewedCount).toBe(466 - 23);
  });

  it("carries the profile the run used and the listing fields", () => {
    expect(ex.profile.id).toBe("ledgerly");
    expect(ex.profile.generalCounsel.email).toMatch(/@/);
    expect({ id: ex.id, company: ex.company, windowStart: ex.windowStart, windowEnd: ex.windowEnd, items: ex.items }).toEqual({
      id: rec.id,
      company: "Ledgerly Inc.",
      windowStart: "2026-11-02",
      windowEnd: "2026-11-06",
      items: 3,
    });
  });
});

describe("projectRecordedRun on constructed copies of a real record", () => {
  it("replaces the POC's leaked relevance score with the neutral reason (constructed: no shipped record has one)", () => {
    const rec = record("t6m4");
    const leaked = { ...rec, items: rec.items.map((i, n) => (n === 0 ? { ...i, reason: "Jev p=0.42 (no LLM reason)" } : i)) };
    const ex = projectRecordedRun(leaked);
    expect(JSON.stringify(ex)).not.toContain("Jev p=");
    const done = doneOf(ex.events);
    expect(done.items[0].reason).toBe(NEUTRAL_REASON);
    expect(done.items[1].reason).toBe(rec.items[1].reason);
    expect(done.items.map((i) => [i.document_number, i.tier, i.owner])).toEqual(rec.items.map((i) => [i.document_number, i.tier, i.owner]));
  });

  it("lists a dropped item as held back, titled from the frozen week (constructed: no shipped record has one)", () => {
    const rec = record("t6m4");
    const ex = projectRecordedRun({ ...rec, dropped: [{ document_number: "2026-22246", why: "The compliance date isn't in the published text." }] });
    const done = doneOf(ex.events);
    expect(done.dropped).toHaveLength(1);
    expect(done.dropped[0].reason).toBe("The compliance date isn't in the published text.");
    expect(done.dropped[0].title).not.toBe("2026-22246");
  });

  it("refuses a record whose text would leak an internal name, instead of writing it", () => {
    const rec = record("t6m4");
    const bad = { ...rec, items: rec.items.map((i, n) => (n === 0 ? { ...i, action: "Ask claude-sonnet about it" } : i)) };
    expect(() => projectRecordedRun(bad)).toThrow(/Internal name "claude-"/);
  });

  it("refuses a failed run: only finished runs become examples", () => {
    const failed = ids().find((r) => r.status === "error")!;
    expect(() => projectRecordedRun(shippedJson(`user-view/runs/${failed.runId}.json`))).toThrow(`Example ${failed.runId} is a failed run; only finished runs become examples`);
  });

  it("refuses a run whose company has no preset and no custom profile", () => {
    const rec = record("t6m4");
    expect(() => projectRecordedRun({ ...rec, config: { ...(rec.config as object), profileId: "brightside" } })).toThrow(
      `Example ${rec.id}: company "brightside" is not a preset and the run carries no custom profile`,
    );
  });

  it("refuses a run whose week is not frozen in config/evalsets/weeks", () => {
    const rec = record("t6m4");
    expect(() => projectRecordedRun({ ...rec, config: { ...(rec.config as object), windowStart: "2026-12-07", windowEnd: "2026-12-11" } })).toThrow(
      `Example ${rec.id}: no frozen week 2026-12-07..2026-12-11 to take titles from`,
    );
  });
});

describe("projectRecordedRun on the custom-profile run with no items (SmileBright, l14a)", () => {
  const ex = projectRecordedRun(record("l14a"));

  it("uses the run's own profile and renders the nothing-applies report with closest calls", () => {
    expect(ex.company).toBe("SmileBright Dental");
    expect(ex.profile.name).toBe("SmileBright Dental");
    const view = reduceEvents(ex.events);
    expect(view.items).toEqual([]);
    expect(view.screenedOut.length).toBe(66);
    expect(view.scanned).toBe(448);
  });
});

describe("exampleIndex", () => {
  it("lists the examples newest first by id, with what the sidebar needs and nothing else", () => {
    const a = projectRecordedRun(record("t6m4"));
    const b = projectRecordedRun(record("l14a"));
    expect(exampleIndex([a, b])).toEqual([
      { id: b.id, company: "SmileBright Dental", windowStart: "2026-11-09", windowEnd: "2026-11-13", items: 0 },
      { id: a.id, company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", items: 3 },
    ]);
  });
});
