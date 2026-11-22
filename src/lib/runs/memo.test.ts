import { beforeAll, describe, expect, it } from "vitest";
import { runReplay } from "../pipeline/__fixtures__/replay";
import { heldBackSection, noActionMemo, withHeldBack } from "./memo";
import { reduceEvents, type RunViewState } from "./reduce";

// The recorded run's real screened-out list (56 documents) stands in for closest calls; held-back and confirmed
// items are constructed, since the recorded run held nothing back.
let recorded: RunViewState;
beforeAll(async () => {
  recorded = reduceEvents((await runReplay()).events);
}, 60_000);

const ctx = { company: "Brightside Foods Co.", windowStart: "2026-11-02", windowEnd: "2026-11-06" };
const held = { document_number: "2026-90001", title: "Card fee rule", reason: "The compliance date we found isn't in the published text." };
const checked = { document_number: "2026-90002", title: "Wire rule", reason: "The citation didn't match.", owner: { name: "Aisha Grant", email: "gc@x.example" }, url: "https://www.federalregister.gov/d/2026-90002" };
const empty = () => ({ ...recorded, items: [], dropped: [], checkedByYou: [] });

describe("noActionMemo", () => {
  it("states the window, the count checked and the first 3 closest calls with their reasons", () => {
    const memo = noActionMemo(empty(), ctx);
    expect(memo).toContain("# No action needed: Brightside Foods Co.");
    expect(memo).toContain("Federal Register documents published Nov 2–6, 2026 (as of Nov 6, 2026).");
    expect(memo).toContain("All 466 federal documents published Nov 2–6 were checked against Brightside Foods Co.'s profile. None needs action.");
    const calls = recorded.screenedOut.slice(0, 3);
    expect(memo).toContain(
      ["## Closest calls", "", ...calls.map((c, i) => `${i + 1}. ${c.title} (${c.document_number}): ${c.reason}`)].join("\n"),
    );
    expect(memo).not.toContain(recorded.screenedOut[3].title);
    expect(memo).not.toContain("## Held back");
  });

  it("says there were no close calls when the screen rejected nothing (0 items, 0 screened out)", () => {
    const memo = noActionMemo({ ...empty(), screenedOut: [] }, ctx);
    expect(memo).toContain("## Closest calls\n\nNo document came close: none reached the final screening.");
    expect(memo).not.toMatch(/^1\. /m);
  });

  it("lists held-back items in their own section, with the Federal Register link to check them", () => {
    const memo = noActionMemo({ ...empty(), dropped: [held] }, ctx);
    expect(memo).toContain(
      "## Held back for you to check\n\nThese looked relevant but failed verification, so they are not in the report.\n\n- Card fee rule (2026-90001): The compliance date we found isn't in the published text. https://www.federalregister.gov/d/2026-90001",
    );
  });
});

describe("heldBackSection", () => {
  it("is empty when nothing was held back or added", () => {
    expect(heldBackSection(recorded)).toBe("");
  });

  it("lists confirmed items apart from those still held back", () => {
    const s = heldBackSection({ ...recorded, dropped: [held], checkedByYou: [checked] });
    expect(s).toContain("## Held back for you to check");
    expect(s).toContain("## Added by you after checking\n\nNot tiered, and their dates were not verified against the Federal Register.\n\n- Wire rule (2026-90002): https://www.federalregister.gov/d/2026-90002");
  });
});

describe("withHeldBack", () => {
  it("appends the section to the run's report markdown, and leaves it untouched otherwise", () => {
    expect(withHeldBack("# Report\n", recorded)).toBe("# Report\n");
    expect(withHeldBack("# Report\n", { ...recorded, dropped: [held] })).toBe(`# Report\n\n${heldBackSection({ ...recorded, dropped: [held] })}`);
  });
});
