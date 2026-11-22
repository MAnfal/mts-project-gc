import { beforeAll, describe, expect, it } from "vitest";
import { runReplay } from "../pipeline/__fixtures__/replay";
import type { ActionItem, Deadline, Tier } from "../types";
import { reduceEvents, type RunViewState } from "./reduce";
import { deadlineLabel, draftEmails, formatWindow, ownerName, reportCounts, reportHeading, reportJson, reportSummary, sortItems, whyTier } from "./report";

let recorded: RunViewState;
beforeAll(async () => {
  recorded = reduceEvents((await runReplay()).events);
}, 60_000);

const marcus = { name: "Marcus Lee (Sanctions)", email: "sanctions@ledgerly.example" };
const priya = { name: "Priya Shah (BSA Officer)", email: "bsa@ledgerly.example" };
const verified = (date: string, kind: Deadline["kind"] = "comment"): Deadline => ({ date, kind, source: "fr_field", verified: true });

function item(n: number, over: Partial<ActionItem> = {}): ActionItem {
  return {
    document_number: `2026-2260${n}`,
    title: `Rule number ${n}`,
    type: "Rule",
    agencies: ["Treasury Department"],
    tier: "Medium",
    tierReason: "proposed rule, comment deadline in 40 days",
    deadline: null,
    deadlines: [],
    owner: marcus,
    areas: ["sanctions"],
    reason: "Why it matters",
    action: `Do thing ${n}`,
    citation: `91 FR 6990${n}`,
    citationVerified: true,
    url: `https://www.federalregister.gov/documents/2026/11/05/2026-2260${n}/x`,
    sourceTag: "[Federal Register]",
    ...over,
  };
}

const ctx = { company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06" };

describe("formatWindow", () => {
  it.each([
    ["2026-11-02", "2026-11-06", "Nov 2–6, 2026", "Nov 2–6"],
    ["2026-10-30", "2026-11-03", "Oct 30 – Nov 3, 2026", "Oct 30 – Nov 3"],
    ["2026-12-29", "2027-01-02", "Dec 29, 2026 – Jan 2, 2027", "Dec 29 – Jan 2"],
    ["2026-11-02", "2026-11-02", "Nov 2, 2026", "Nov 2"],
  ])("%s..%s → %s / %s", (start, end, long, short) => {
    expect(formatWindow(start, end)).toBe(long);
    expect(formatWindow(start, end, { year: false })).toBe(short);
  });
});

describe("ownerName", () => {
  it("drops the role in parentheses", () => {
    expect(ownerName(marcus)).toBe("Marcus Lee");
    expect(ownerName({ name: "Legal", email: "x" })).toBe("Legal");
  });
});

describe("reportHeading", () => {
  it("is written from the recorded run's items: count, doc type, owner and Critical count", () => {
    expect(reportHeading(recorded.items, ctx)).toBe("3 notices for Aisha Grant, nothing Critical");
  });

  it("changes with the items", () => {
    expect(reportHeading([item(1, { type: "Presidential Document" })], ctx)).toBe("1 presidential document for Marcus Lee, nothing Critical");
    expect(reportHeading([item(1, { tier: "Critical" }), item(2), item(3, { tier: "Critical", owner: priya })], ctx)).toBe("3 rules for 2 owners, 2 Critical");
    expect(reportHeading([item(1), item(2, { type: "Notice" })], ctx)).toBe("2 items for Marcus Lee, nothing Critical");
    expect(reportHeading([item(1, { type: "Proposed Rule" }), item(2, { type: "Proposed Rule" })], ctx)).toBe("2 proposed rules for Marcus Lee, nothing Critical");
  });

  it("says nothing affects the company when there are no items", () => {
    expect(reportHeading([], ctx)).toBe("Nothing published Nov 2–6 affects Ledgerly Inc.");
  });
});

describe("reportSummary", () => {
  it("for the recorded run", () => {
    expect(reportSummary(recorded, { ...ctx, company: "Brightside Foods Co." })).toBe(
      "Of 466 federal documents published Nov 2–6, 3 affect Brightside Foods Co. Priority: 3 Low. Every deadline and citation below matched the Federal Register.",
    );
  });

  it("names every tier present, unmatched citations and held-back items", () => {
    const view = { ...recorded, scanned: 120, items: [item(1, { tier: "Critical" }), item(2, { tier: "High", citationVerified: false }), item(3)], dropped: [{ document_number: "x", title: "X", reason: "r" }] };
    expect(reportSummary(view, ctx)).toBe(
      "Of 120 federal documents published Nov 2–6, 3 affect Ledgerly Inc. Priority: 1 Critical, 1 High, 1 Medium. Every deadline below matched the Federal Register; 1 citation couldn't be matched and is marked. 1 more was held back because its dates or citation couldn't be confirmed.",
    );
  });

  it("uses singular and plural forms", () => {
    const view = { ...recorded, scanned: 9, items: [item(1, { citationVerified: false }), item(2, { citationVerified: false })], dropped: [{ document_number: "x", title: "X", reason: "r" }, { document_number: "y", title: "Y", reason: "r" }] };
    expect(reportSummary(view, ctx)).toBe(
      "Of 9 federal documents published Nov 2–6, 2 affect Ledgerly Inc. Priority: 2 Medium. Every deadline below matched the Federal Register; 2 citations couldn't be matched and are marked. 2 more were held back because their dates or citation couldn't be confirmed.",
    );
    expect(reportSummary({ ...recorded, scanned: 1, items: [item(1)], dropped: [] }, ctx)).toBe(
      "Of 1 federal document published Nov 2–6, 1 affects Ledgerly Inc. Priority: 1 Medium. Every deadline and citation below matched the Federal Register.",
    );
  });

  it("with no items", () => {
    expect(reportSummary({ ...recorded, scanned: 466, items: [], dropped: [] }, ctx)).toBe("None of the 466 federal documents published Nov 2–6 affects Ledgerly Inc.");
  });
});

describe("reportCounts", () => {
  it("counts tiers, held back and not relevant from the lists, never by subtracting from scanned", () => {
    // 500 scanned, but the lists sum to less: a document the screen never answered is in neither.
    const view = { ...recorded, scanned: 500, notReviewedCount: 400, items: [item(1, { tier: "Critical" }), item(2), item(3)], dropped: [{ document_number: "x", title: "X", reason: "r" }] };
    expect(reportCounts(view)).toEqual({ tiers: { Critical: 1, High: 0, Medium: 2, Low: 0 }, heldBack: 1, notRelevant: recorded.screenedOut.length, notReviewed: 400 });
    expect(reportCounts(recorded)).toEqual({ tiers: { Critical: 0, High: 0, Medium: 0, Low: 3 }, heldBack: 0, notRelevant: 56, notReviewed: 407 });
  });
});

describe("sortItems", () => {
  it("orders by tier, Critical first, keeping the run's order within a tier", () => {
    const tiers: Tier[] = ["Low", "Medium", "Critical", "High", "Medium", "Critical"];
    const sorted = sortItems(tiers.map((tier, i) => item(i, { tier })));
    expect(sorted.map((i) => [i.tier, i.document_number.at(-1)])).toEqual([
      ["Critical", "2"],
      ["Critical", "5"],
      ["High", "3"],
      ["Medium", "1"],
      ["Medium", "4"],
      ["Low", "0"],
    ]);
  });
});

describe("whyTier", () => {
  it("states the tier rule's reason in plain words", () => {
    expect(whyTier(recorded.items[0])).toBe("Why Low: notice, no deadline.");
    expect(whyTier(item(1, { tier: "Critical", tierReason: "comment deadline in 21 days (< 90)" }))).toBe("Why Critical: comment deadline in 21 days (under 90).");
    expect(whyTier(item(1, { tier: "Medium", tierReason: "notice with comment deadline in 21 days" }))).toBe("Why Medium: notice with comment deadline in 21 days.");
  });
});

describe("deadlineLabel", () => {
  it("names the kind and the date", () => {
    expect(deadlineLabel(verified("2026-11-14"))).toEqual({ kind: "Comments due", date: "Nov 14, 2026" });
    expect(deadlineLabel(verified("2027-01-01", "effective"))).toEqual({ kind: "Effective", date: "Jan 1, 2027" });
    expect(deadlineLabel(verified("2026-12-01", "compliance"))).toEqual({ kind: "Comply by", date: "Dec 1, 2026" });
    expect(deadlineLabel(verified("2026-12-01", "other"))).toEqual({ kind: "Date", date: "Dec 1, 2026" });
  });
});

describe("draftEmails", () => {
  const items = sortItems([item(1, { deadline: verified("2026-11-14") }), item(2, { owner: priya, tier: "Critical" }), item(3)]);
  const drafts = draftEmails(items, ctx);
  const decode = (href: string) => {
    const url = new URL(href);
    return { to: decodeURIComponent(url.pathname), subject: url.searchParams.get("subject"), body: url.searchParams.get("body") ?? "" };
  };

  it("drafts one email per owner, in report order", () => {
    expect(drafts.map((d) => [d.name, d.count])).toEqual([
      ["Priya Shah", 1],
      ["Marcus Lee", 2],
    ]);
    expect(decode(drafts[1].href).to).toBe("sanctions@ledgerly.example");
    expect(decode(drafts[1].href).subject).toBe("Federal rules for you to review: Nov 2–6, 2026 (2 items)");
  });

  it("lists only that owner's items, each with what to do, its deadline and its source", () => {
    const { body } = decode(drafts[1].href);
    expect(body.startsWith("Hi Marcus,\n\n")).toBe(true);
    expect(body).toContain("1. Rule number 1 [Medium]\n   What to do: Do thing 1\n   Comments due Nov 14, 2026 (verified against the Federal Register)\n   Source: https://www.federalregister.gov/documents/2026/11/05/2026-22601/x");
    expect(body).toContain("2. Rule number 3 [Medium]\n   What to do: Do thing 3\n   No dated deadline\n   Source:");
    expect(body).not.toContain("Rule number 2");
    expect(decode(drafts[0].href).body).toContain("Rule number 2 [Critical]");
  });

  it("encodes the body so a title with & or # can't cut the link short", () => {
    const [d] = draftEmails([item(1, { title: "Fees & charges #4 ?ok" })], ctx);
    expect(d.href).not.toMatch(/[ #&](?!body=)/);
    expect(decode(d.href).body).toContain("Fees & charges #4 ?ok");
  });

  it("doesn't call an unverified deadline verified", () => {
    const [d] = draftEmails([item(1, { deadline: { ...verified("2026-11-14"), verified: false } })], ctx);
    const body = new URL(d.href).searchParams.get("body") ?? "";
    expect(body).toContain("   Comments due Nov 14, 2026\n");
    expect(body).not.toContain("verified");
  });

  it("drafts nothing for no items", () => {
    expect(draftEmails([], ctx)).toEqual([]);
  });
});

describe("reportJson", () => {
  it("is the report the GC downloads: window, counts and lists, nothing internal", () => {
    const parsed = JSON.parse(reportJson(recorded, { company: "Brightside Foods Co." }));
    expect(Object.keys(parsed)).toEqual(["company", "windowStart", "windowEnd", "asOf", "scanned", "items", "heldBack", "screenedOut", "notReviewedCount"]);
    expect(parsed).toMatchObject({ company: "Brightside Foods Co.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06", scanned: 466, notReviewedCount: 407 });
    expect(parsed.items).toEqual(sortItems(recorded.items));
    expect(parsed.screenedOut).toHaveLength(56);
  });
});
