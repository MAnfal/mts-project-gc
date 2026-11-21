import { describe, expect, it } from "vitest";

type Dec = { relevant: boolean; reason: string; areas: string[] };
const pass = (o: Record<string, Partial<Dec> & { relevant: boolean }>) =>
  new Map(Object.entries(o).map(([k, v]) => [k, { reason: v.relevant ? "yes" : "no", areas: [], ...v }]));

describe("combineFilterPasses (majority vote over repeated LLM filter passes)", () => {
  it("keeps a doc only when a majority of passes call it relevant", async () => {
    const { combineFilterPasses } = await import("../src/lib/pipeline/stages");
    const out = combineFilterPasses(
      [pass({ a: { relevant: true }, b: { relevant: true }, c: { relevant: false } }), pass({ a: { relevant: true }, b: { relevant: false }, c: { relevant: false } }), pass({ a: { relevant: false }, b: { relevant: true }, c: { relevant: true } })],
      3,
    );
    expect(out.get("a")?.relevant).toBe(true);
    expect(out.get("b")?.relevant).toBe(true);
    expect(out.get("c")?.relevant).toBe(false);
    expect(out.get("a")?.votes).toEqual({ yes: 2, no: 1, passes: 3 });
  });

  it("a pass that didn't answer is an abstention, never a yes", async () => {
    const { combineFilterPasses } = await import("../src/lib/pipeline/stages");
    const out = combineFilterPasses([pass({ a: { relevant: true } }), pass({ a: { relevant: false } }), pass({})], 3);
    expect(out.get("a")?.relevant).toBe(false);
    expect(out.get("a")?.votes).toEqual({ yes: 1, no: 1, passes: 3 });
  });

  it("takes reason and areas from a pass that agrees with the majority", async () => {
    const { combineFilterPasses } = await import("../src/lib/pipeline/stages");
    const out = combineFilterPasses(
      [pass({ a: { relevant: false, reason: "minority" } }), pass({ a: { relevant: true, reason: "majority", areas: ["sourcing"] } }), pass({ a: { relevant: true, reason: "also" } })],
      3,
    );
    expect(out.get("a")).toMatchObject({ relevant: true, reason: "majority", areas: ["sourcing"] });
  });

  it("one pass is a pass-through", async () => {
    const { combineFilterPasses } = await import("../src/lib/pipeline/stages");
    const out = combineFilterPasses([pass({ a: { relevant: true, reason: "r" }, b: { relevant: false } })], 1);
    expect(out.get("a")).toMatchObject({ relevant: true, reason: "r" });
    expect(out.get("b")?.relevant).toBe(false);
  });
});

describe("filterVotes setup knob", () => {
  it("a setup's filterVotes reaches its run config; setups without it don't set it", async () => {
    const { cellByKey, cellConfig } = await import("../src/lib/arena");
    const base = { profileId: "brightside", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13" };
    expect(cellConfig(cellByKey("jev-sonnet-strict-vote3")!, base, "x").filterVotes).toBe(3);
    expect(cellConfig(cellByKey("jev-sonnet-strict")!, base, "x").filterVotes).toBeUndefined();
  });
});
