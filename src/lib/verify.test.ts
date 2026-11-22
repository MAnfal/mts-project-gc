import { describe, expect, it } from "vitest";
import { verifyQuotedDate, parseDocNumberFromUrl } from "./verify";

const source = `DATES: Comments must be received on or before January 12, 2027.
SUPPLEMENTARY INFORMATION: The  rule is effective   December 10, 2026, and compliance is required by 06/01/2027.`;

describe("verifyQuotedDate", () => {
  it("accepts a verbatim quote that contains the claimed date", () => {
    const r = verifyQuotedDate(source, "Comments must be received on or before January 12, 2027.", "2027-01-12");
    expect(r.ok).toBe(true);
  });

  it("tolerates whitespace differences between quote and source", () => {
    const r = verifyQuotedDate(source, "The rule is effective December 10, 2026", "2026-12-10");
    expect(r.ok).toBe(true);
  });

  it("accepts MM/DD/YYYY in the quote", () => {
    const r = verifyQuotedDate(source, "compliance is required by 06/01/2027", "2027-06-01");
    expect(r.ok).toBe(true);
  });

  it("rejects a quote not present in the source (fabricated)", () => {
    const r = verifyQuotedDate(source, "Comments must be received on or before February 1, 2027.", "2027-02-01");
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/not found/);
  });

  it("rejects when the quote is real but the claimed date is not in it", () => {
    const r = verifyQuotedDate(source, "Comments must be received on or before January 12, 2027.", "2027-01-13");
    expect(r.ok).toBe(false);
    expect(r.why).toMatch(/date/);
  });

  it("rejects an empty quote", () => {
    expect(verifyQuotedDate(source, "", "2027-01-12").ok).toBe(false);
  });
});

describe("parseDocNumberFromUrl", () => {
  it("parses a standard federalregister.gov document URL", () => {
    expect(parseDocNumberFromUrl("https://www.federalregister.gov/documents/2026/11/09/2026-22809/threshold-for-the")).toBe("2026-22809");
  });
  it("parses full-text html URLs", () => {
    expect(parseDocNumberFromUrl("https://www.federalregister.gov/documents/full_text/html/2026/11/09/2026-22809.html")).toBe("2026-22809");
  });
  it("parses correction numbers like C1-2026-22802", () => {
    expect(parseDocNumberFromUrl("https://www.federalregister.gov/documents/2026/11/13/C1-2026-22802/notice")).toBe("C1-2026-22802");
  });
  it("parses full-text xml URLs (seen in Exa results)", () => {
    expect(parseDocNumberFromUrl("https://www.federalregister.gov/documents/full_text/xml/2026/11/09/2026-22809.xml")).toBe("2026-22809");
  });
  it("returns null for non-FR URLs", () => {
    expect(parseDocNumberFromUrl("https://www.consumerfinance.gov/rules-policy/")).toBeNull();
  });
});
