import { describe, expect, it } from "vitest";
import { chunkText, pickPassages } from "./excerpts";

// Ported from poc:poc/tests/filter-excerpts.test.ts (the excerpts part).

describe("chunkText (split full text into passages for the relevance model to score)", () => {
  it("splits on whitespace into passages no longer than the limit and loses no words", () => {
    const text = Array.from({ length: 300 }, (_, i) => `word${i}`).join(" ");
    const chunks = chunkText(text, 100);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join(" ").split(/\s+/)).toEqual(text.split(/\s+/));
  });

  it("caps the number of passages per document, keeping an even spread", () => {
    expect(chunkText("a ".repeat(5000), 20, 7)).toHaveLength(7);
    const numbered = Array.from({ length: 10 }, (_, i) => `p${i}`).join(" ");
    expect(chunkText(numbered, 2, 5)).toEqual(["p0", "p2", "p4", "p6", "p8"]);
  });

  it("cuts a single word longer than the limit, and returns nothing for empty text", () => {
    expect(chunkText("x".repeat(50), 10)).toEqual(["x".repeat(10)]);
    expect(chunkText("   ", 10)).toEqual([]);
  });
});

describe("pickPassages (the best k passages go to the LLM filter)", () => {
  it("keeps the k highest-scoring passages, in document order", () => {
    expect(pickPassages(["p0", "p1", "p2", "p3"], [0.1, 0.9, 0.05, 0.7], 2)).toEqual([
      { index: 1, text: "p1", p: 0.9 },
      { index: 3, text: "p3", p: 0.7 },
    ]);
  });

  it("scores a passage with no score as 0", () => {
    expect(pickPassages(["p0", "p1"], [0.2], 1)).toEqual([{ index: 0, text: "p0", p: 0.2 }]);
  });
});
