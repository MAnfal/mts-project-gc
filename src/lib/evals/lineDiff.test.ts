import { describe, expect, it } from "vitest";
import { lineDiff } from "./lineDiff";

describe("lineDiff (side-by-side prompt diff)", () => {
  it("pairs equal lines, and marks lines only in the old text removed and only in the new text added", () => {
    const rows = lineDiff("a\nb\nc", "a\nB\nc\nd");
    expect(rows).toEqual([
      { left: { text: "a", kind: "same" }, right: { text: "a", kind: "same" } },
      { left: { text: "b", kind: "removed" }, right: { text: "B", kind: "added" } },
      { left: { text: "c", kind: "same" }, right: { text: "c", kind: "same" } },
      { left: null, right: { text: "d", kind: "added" } },
    ]);
  });

  it("leaves the other side empty when one side has more changed lines", () => {
    expect(lineDiff("x\ny", "z")).toEqual([
      { left: { text: "x", kind: "removed" }, right: { text: "z", kind: "added" } },
      { left: { text: "y", kind: "removed" }, right: null },
    ]);
  });

  it("returns every line as same for identical texts", () => {
    expect(lineDiff("p\nq", "p\nq").every((r) => r.left?.kind === "same" && r.right?.kind === "same")).toBe(true);
  });
});
