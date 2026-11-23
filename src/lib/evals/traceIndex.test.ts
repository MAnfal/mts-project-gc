import { describe, expect, it } from "vitest";
import { shippedTrace } from "./__fixtures__/shipped";
import type { TraceEvent } from "./loader";
import { eventLabel, eventSummary, filterTrace, indexTrace, valueText } from "./traceIndex";

// The largest shipped trace (2,104 events): l92, jev-sonnet-strict-passages, CornerCare Nov 2–6, repeat 0.
const L92 = "arena-2026-11-21-22-52-l92";
const LARGEST = "2026-11-21T22-52-25-354Z_pipeline_k6tv";
const events = shippedTrace<TraceEvent>(L92, LARGEST);
const index = indexTrace(events);
const none = new Set<string>();

describe("indexTrace on the largest shipped trace", () => {
  it("indexes every event", () => {
    expect(events).toHaveLength(2104);
    expect(filterTrace(index, { hidden: none, query: "" })).toHaveLength(2104);
  });

  it("counts each event type, in first-seen order, summing to the event count", () => {
    const direct = new Map<string, number>();
    for (const e of events) direct.set(e.type, (direct.get(e.type) ?? 0) + 1);
    expect(index.types).toEqual([...direct].map(([type, count]) => ({ type, count })));
    expect(index.types[0].type).toBe("run.start");
  });
});

describe("filterTrace", () => {
  it("shows only the types left visible", () => {
    const hidden = new Set(index.types.map((t) => t.type).filter((t) => t !== "filter.decision"));
    const shown = filterTrace(index, { hidden, query: "" });
    expect(shown).toHaveLength(events.filter((e) => e.type === "filter.decision").length);
    expect(shown.every((i) => events[i].type === "filter.decision")).toBe(true);
  });

  it("finds a document number wherever it appears as a value, and nowhere else", () => {
    const doc = "2026-22248";
    const shown = filterTrace(index, { hidden: none, query: doc });
    expect(shown).toEqual(events.flatMap((e, i) => (JSON.stringify(e).includes(doc) ? [i] : [])));
    expect(shown.length).toBeGreaterThan(1);
  });

  it("matches values, not keys: a word that is only ever a key finds nothing", () => {
    expect(JSON.stringify(events).includes("passedJev")).toBe(true); // it is a key in every filter.decision
    expect(filterTrace(index, { hidden: none, query: "passedJev" })).toEqual([]);
    expect(filterTrace(index, { hidden: none, query: "jevProbability" })).toEqual([]);
  });

  it("searches words case-insensitively, inside nested values (the LLM's reason)", () => {
    const shown = filterTrace(index, { hidden: none, query: "STATE DEPARTMENT SANCTIONS" });
    expect(shown.map((i) => events[i].type)).toContain("filter.decision");
    expect(shown.every((i) => JSON.stringify(events[i]).toLowerCase().includes("state department sanctions"))).toBe(true);
  });

  it("applies the type filter and the search together", () => {
    const hidden = new Set(["jev.call"]);
    const shown = filterTrace(index, { hidden, query: "2026-22248" });
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.some((i) => events[i].type === "jev.call")).toBe(false);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterTrace(index, { hidden: none, query: "  2026-22248 " })).toEqual(filterTrace(index, { hidden: none, query: "2026-22248" }));
  });
});

describe("an empty trace", () => {
  it("has no types and shows nothing", () => {
    const empty = indexTrace([]);
    expect(empty.types).toEqual([]);
    expect(filterTrace(empty, { hidden: none, query: "" })).toEqual([]);
    expect(filterTrace(empty, { hidden: none, query: "x" })).toEqual([]);
  });
});

describe("valueText", () => {
  it("joins nested values, lowercased, without keys", () => {
    expect(valueText({ Key: "A", n: 1, nested: { deep: ["B", true, null] } })).toBe("a\n1\nb\ntrue");
  });
});

describe("eventSummary (ported from the POC's TraceTimeline summary())", () => {
  const first = (type: string) => events.find((e) => e.type === type)!;

  it("summarises a filter decision with its verdict, Jev score and the LLM's reason", () => {
    const e = events.find((x) => x.type === "filter.decision" && x.document_number === "2026-22248")!;
    expect(eventSummary(e)).toBe(
      "2026-22248 · not relevant · Jev 0.23 ✓ · “State Department sanctions on Russian entities for trade-secret theft; imposes nothing on a Midwest retail pharmacy chain.”",
    );
  });

  it("summarises a Jev call by its probability and the run's start by mode, model and config", () => {
    expect(eventSummary(first("jev.call"))).toMatch(/^\S+ · p = \d\.\d{3}$/);
    expect(eventSummary(first("run.start"))).toMatch(/^pipeline · anthropic\/claude-sonnet-5\.5 · prompt set strict · config \w+$/);
  });

  it("summarises passages by how many were picked of how many scored", () => {
    const e = first("filter.passages") as TraceEvent & { picked: unknown[]; chunks: number };
    expect(eventSummary(e)).toBe(`${e.document_number} · ${e.picked.length} of ${e.chunks} passages`);
  });

  it("is empty for an unknown type, and labels unknown types by their raw name", () => {
    expect(eventSummary({ seq: 0, type: "x.new" })).toBe("");
    expect(eventLabel("x.new")).toBe("x.new");
    expect(eventLabel("filter.decision")).toBe("Decision");
  });
});
