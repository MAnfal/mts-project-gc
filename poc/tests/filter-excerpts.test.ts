import { describe, expect, it } from "vitest";
import { getCompany } from "../src/lib/config";
import type { FrDoc } from "../src/lib/types";

const doc = (n: string, abstract = "short abstract"): FrDoc =>
  ({ document_number: n, type: "Proposed Rule", title: `Title ${n}`, abstract, agencies: [{ name: "PHMSA" }], publication_date: "2026-10-27" }) as unknown as FrDoc;

describe("chunkText (split full text into passages for Jev to score)", () => {
  it("splits on whitespace into passages no longer than the limit and loses no words", async () => {
    const { chunkText } = await import("../src/lib/pipeline/excerpts");
    const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ").split(/\s+/)).toEqual(text.split(/\s+/));
  });

  it("caps the number of passages per document", async () => {
    const { chunkText } = await import("../src/lib/pipeline/excerpts");
    expect(chunkText("a ".repeat(5000), 20, 7)).toHaveLength(7);
  });
});

describe("pickPassages (Jev re-ranks passages; the best k go to the LLM filter)", () => {
  it("keeps the k highest-scoring passages, in document order", async () => {
    const { pickPassages } = await import("../src/lib/pipeline/excerpts");
    expect(pickPassages(["p0", "p1", "p2", "p3"], [0.1, 0.9, 0.05, 0.7], 2)).toEqual([
      { index: 1, text: "p1", p: 0.9 },
      { index: 3, text: "p3", p: 0.7 },
    ]);
  });
});

describe("filterPrompt with passages", () => {
  it("without passages the prompt is unchanged (control setups stay byte-identical)", async () => {
    const { filterPrompt } = await import("../src/lib/prompts");
    const co = getCompany("skyhop");
    expect(filterPrompt(co, [doc("A")], new Map())).toBe(filterPrompt(co, [doc("A")]));
  });

  it("adds the selected passages under their own document only", async () => {
    const { filterPrompt } = await import("../src/lib/prompts");
    const out = filterPrompt(getCompany("skyhop"), [doc("A"), doc("B")], new Map([["A", ["limits passengers to two power banks"]]]));
    const a = out.slice(out.indexOf("[A]"), out.indexOf("[B]"));
    const b = out.slice(out.indexOf("[B]"));
    expect(a).toContain("two power banks");
    expect(b).not.toContain("two power banks");
  });
});

describe("filterExcerpts setup knob", () => {
  it("reaches the candidate's run config only", async () => {
    const { cellByKey, cellConfig } = await import("../src/lib/arena");
    const base = { profileId: "skyhop", windowStart: "2026-10-26", windowEnd: "2026-10-30", asOf: "2026-10-30" };
    expect(cellConfig(cellByKey("jev-sonnet-strict-passages")!, base, "x").filterExcerpts).toEqual({ topN: 20, chunkChars: 1200, perDoc: 3, maxChunks: 300 });
    expect(cellConfig(cellByKey("jev-sonnet-strict")!, base, "x").filterExcerpts).toBeUndefined();
  });
});
