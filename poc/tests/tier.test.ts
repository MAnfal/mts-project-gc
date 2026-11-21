import { describe, expect, it } from "vitest";
import { assignTier } from "../src/lib/tier";
import type { Deadline } from "../src/lib/types";

const d = (date: string, kind: Deadline["kind"], verified = true): Deadline => ({
  date,
  kind,
  source: "fr_field",
  verified,
});

// Cases are taken from the real week of 2026-11-09..13 where possible.
describe("assignTier", () => {
  const asOf = "2026-11-13";

  it("proposed rule with a comment deadline under 90 days is Critical", () => {
    const r = assignTier({ type: "Proposed Rule", deadlines: [d("2027-01-11", "comment")], asOf });
    expect(r.tier).toBe("Critical");
    expect(r.deadline?.date).toBe("2027-01-11");
  });

  it("deadline exactly 90 days out is not Critical (strictly < 90)", () => {
    const r = assignTier({ type: "Proposed Rule", deadlines: [d("2027-02-11", "comment")], asOf });
    expect(r.tier).toBe("Medium");
  });

  it("deadline 89 days out is Critical", () => {
    const r = assignTier({ type: "Proposed Rule", deadlines: [d("2027-02-10", "comment")], asOf });
    expect(r.tier).toBe("Critical");
  });

  it("final rule already effective inside the window is Critical (2026-22863)", () => {
    const r = assignTier({ type: "Rule", deadlines: [d("2026-11-10", "effective")], asOf });
    expect(r.tier).toBe("Critical");
    expect(r.reason).toMatch(/already in effect/i);
  });

  it("final rule effective long before asOf is High, not Critical (OFAC GL published months after issuance, 2026-23195)", () => {
    const r = assignTier({ type: "Rule", deadlines: [d("2026-05-07", "effective")], asOf });
    expect(r.tier).toBe("High");
    expect(r.reason).toMatch(/in effect since 2026-05-07/);
  });

  it("final rule effective 30 days before asOf is still Critical (recently effective)", () => {
    const r = assignTier({ type: "Rule", deadlines: [d("2026-10-14", "effective")], asOf });
    expect(r.tier).toBe("Critical");
  });

  it("comment period already closed does not make it Critical (2026-22859)", () => {
    const r = assignTier({ type: "Proposed Rule", deadlines: [d("2026-10-26", "comment")], asOf });
    expect(r.tier).toBe("Medium");
    expect(r.deadline).toBeNull();
  });

  it("final rule with no deadline is High (OFAC web general licenses)", () => {
    const r = assignTier({ type: "Rule", deadlines: [], asOf });
    expect(r.tier).toBe("High");
    expect(r.deadline).toBeNull();
  });

  it("unverified deadlines are ignored", () => {
    const r = assignTier({ type: "Proposed Rule", deadlines: [d("2026-12-01", "comment", false)], asOf });
    expect(r.tier).toBe("Medium");
    expect(r.deadline).toBeNull();
  });

  it("notice with a near comment deadline is Medium, not Critical (PRA info-collection requests)", () => {
    const r = assignTier({ type: "Notice", deadlines: [d("2027-01-12", "comment")], asOf });
    expect(r.tier).toBe("Medium");
    expect(r.deadline?.date).toBe("2027-01-12");
  });

  it("notice without deadline is Low", () => {
    const r = assignTier({ type: "Notice", deadlines: [], asOf });
    expect(r.tier).toBe("Low");
  });

  it("picks the earliest upcoming verified deadline", () => {
    const r = assignTier({
      type: "Rule",
      deadlines: [d("2027-06-01", "compliance"), d("2026-12-14", "effective")],
      asOf,
    });
    expect(r.tier).toBe("Critical");
    expect(r.deadline?.date).toBe("2026-12-14");
  });

  it("is a pure function of its inputs (same input, same tier)", () => {
    const input = { type: "Rule" as const, deadlines: [d("2026-12-10", "effective")], asOf };
    expect(assignTier(input)).toEqual(assignTier(input));
  });
});
