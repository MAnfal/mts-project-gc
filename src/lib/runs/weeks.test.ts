import { describe, expect, it } from "vitest";
import { lastFullWeeks, scanNote, todayInNewYork, validateWindow, weekLabel, windowDays } from "./weeks";

// Constructed dates: 2026-11-23 is a Monday, 2026-11-20 a Friday, 2026-11-21 a Saturday, 2026-11-22 a Sunday,
// 2027-01-02 a Saturday (its Friday is New Year's Day, so the newest week straddles two years).

describe("lastFullWeeks", () => {
  it("on a Monday, the newest full week is the Mon–Fri just ended, then the two before it", () => {
    expect(lastFullWeeks("2026-11-23", 3)).toEqual([
      { start: "2026-11-16", end: "2026-11-20" },
      { start: "2026-11-09", end: "2026-11-13" },
      { start: "2026-11-02", end: "2026-11-06" },
    ]);
  });

  it("on a Saturday and a Sunday, the week that ended on Friday is already full", () => {
    expect(lastFullWeeks("2026-11-21", 1)).toEqual([{ start: "2026-11-16", end: "2026-11-20" }]);
    expect(lastFullWeeks("2026-11-22", 1)).toEqual([{ start: "2026-11-16", end: "2026-11-20" }]);
  });

  it("on a Friday, that week is not full yet (its Friday is not before today), so the newest is the week before", () => {
    expect(lastFullWeeks("2026-11-20", 2)).toEqual([
      { start: "2026-11-09", end: "2026-11-13" },
      { start: "2026-11-02", end: "2026-11-06" },
    ]);
  });

  it("crosses a year boundary: on Sat Jan 2, 2027 the newest week runs Mon Dec 28 – Fri Jan 1", () => {
    expect(lastFullWeeks("2027-01-02", 2)).toEqual([
      { start: "2026-12-28", end: "2027-01-01" },
      { start: "2026-12-21", end: "2026-12-25" },
    ]);
  });

  it("every window is five days, Monday to Friday", () => {
    for (const w of lastFullWeeks("2026-03-04", 3)) {
      expect(windowDays(w.start, w.end)).toBe(5);
      expect(new Date(`${w.start}T12:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${w.end}T12:00:00Z`).getUTCDay()).toBe(5);
    }
  });
});

describe("windowDays (inclusive, the count the run route enforces)", () => {
  it("counts both ends: Mon 2 → Fri 6 is 5, one day is 1, a reversed window is below 1", () => {
    expect(windowDays("2026-11-02", "2026-11-06")).toBe(5);
    expect(windowDays("2026-11-02", "2026-11-02")).toBe(1);
    expect(windowDays("2026-11-06", "2026-11-02")).toBe(-3);
  });
});

describe("validateWindow", () => {
  it("accepts a window of exactly maxWindowDays and a one-day window", () => {
    expect(validateWindow("2026-11-02", "2026-11-08", 7)).toBeNull();
    expect(validateWindow("2026-11-02", "2026-11-02", 7)).toBeNull();
  });

  it("rejects 8 days when the maximum is 7", () => {
    expect(validateWindow("2026-11-02", "2026-11-09", 7)).toBe("Pick a window of at most 7 days.");
  });

  it("rejects a reversed window", () => {
    expect(validateWindow("2026-11-06", "2026-11-02", 7)).toBe("The window ends before it starts.");
  });

  it("asks for both dates when one is empty or not a real date", () => {
    expect(validateWindow("", "2026-11-06", 7)).toBe("Pick a start and an end date.");
    expect(validateWindow("2026-11-02", "", 7)).toBe("Pick a start and an end date.");
    expect(validateWindow("2026-02-30", "2026-03-02", 7)).toBe("Pick a start and an end date.");
  });
});

describe("todayInNewYork (the Federal Register's day, not the server's or the browser's)", () => {
  it("is still the previous day in New York when UTC has already rolled over", () => {
    // 03:00 UTC on Nov 23 is 22:00 EST on Nov 22.
    expect(todayInNewYork(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-22");
  });

  it("is the same day once New York's midnight has passed (EDT in summer, UTC-4)", () => {
    expect(todayInNewYork(new Date("2026-07-01T04:30:00Z"))).toBe("2026-07-01");
    expect(todayInNewYork(new Date("2026-07-01T03:30:00Z"))).toBe("2026-06-30");
  });
});

describe("labels", () => {
  it("names the newest week 'Last full week' and the others by their dates", () => {
    expect(weekLabel({ start: "2026-11-16", end: "2026-11-20" }, 0)).toBe("Last full week · Nov 16–20");
    expect(weekLabel({ start: "2026-11-09", end: "2026-11-13" }, 1)).toBe("Nov 9–13");
    expect(weekLabel({ start: "2026-12-28", end: "2027-01-01" }, 1)).toBe("Dec 28 – Jan 1");
  });

  it("states exactly which days the run scans, with weekdays", () => {
    expect(scanNote("2026-11-02", "2026-11-06")).toBe("Scans every federal document published Mon Nov 2 – Fri Nov 6.");
    expect(scanNote("2026-11-03", "2026-11-03")).toBe("Scans every federal document published Tue Nov 3.");
    expect(scanNote("2026-12-28", "2027-01-01")).toBe("Scans every federal document published Mon Dec 28, 2026 – Fri Jan 1, 2027.");
  });
});
