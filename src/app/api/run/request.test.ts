import { describe, expect, it } from "vitest";
import type { CompanyProfile } from "@/lib/types";
import { parseRunRequest } from "./request";

const limits = { maxWindowDays: 7, presetIds: ["ledgerly", "hearth"] };
const week = { windowStart: "2026-11-02", windowEnd: "2026-11-06" };
const custom: CompanyProfile = {
  id: "acme",
  use: "demo",
  name: "Acme Widgets",
  summary: "Makes widgets.",
  businessLines: ["Widgets"],
  applies: ["Product safety"],
  doesNotApply: ["Banking"],
  areas: { safety: { description: "Product safety", owner: { name: "Ann Lee", email: "ann@acme.example" } } },
  generalCounsel: { name: "Gail Counsel", email: "gc@acme.example" },
};

const reject = (body: unknown) => {
  const r = parseRunRequest(body, limits);
  if (r.ok) throw new Error(`accepted: ${JSON.stringify(body)}`);
  return r.message;
};

describe("parseRunRequest: accepted", () => {
  it("a preset id and a window", () => {
    expect(parseRunRequest({ profileId: "ledgerly", ...week }, limits)).toEqual({ ok: true, request: { profileId: "ledgerly", ...week } });
  });

  it("a custom profile, kept whole (areas and owners included)", () => {
    expect(parseRunRequest({ customProfile: custom, ...week }, limits)).toEqual({ ok: true, request: { customProfile: custom, ...week } });
  });

  it("a window of exactly maxWindowDays, counted inclusively, and a one-day window", () => {
    expect(parseRunRequest({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-08" }, limits).ok).toBe(true);
    expect(parseRunRequest({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-02" }, limits).ok).toBe(true);
  });

  it("drops unknown top-level fields instead of passing them on", () => {
    expect(parseRunRequest({ profileId: "ledgerly", ...week, model: "x" }, limits)).toEqual({ ok: true, request: { profileId: "ledgerly", ...week } });
  });
});

describe("parseRunRequest: rejected with a plain message", () => {
  it("an unknown profile id", () => {
    expect(reject({ profileId: "nope", ...week })).toBe("Unknown company profile. Pick one of the presets or send your own profile.");
  });

  it("an eval company that exists in config but is not a preset", () => {
    expect(reject({ profileId: "brightside", ...week })).toBe("Unknown company profile. Pick one of the presets or send your own profile.");
  });

  it("a window one day longer than maxWindowDays (8 days)", () => {
    expect(reject({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-09" })).toBe("Pick a window of at most 7 days.");
  });

  it("a 30-day window", () => {
    expect(reject({ profileId: "ledgerly", windowStart: "2026-11-01", windowEnd: "2026-11-30" })).toBe("Pick a window of at most 7 days.");
  });

  it("a window that ends before it starts", () => {
    expect(reject({ profileId: "ledgerly", windowStart: "2026-11-06", windowEnd: "2026-11-02" })).toBe("The window ends before it starts.");
  });

  it.each([["2026-13-01"], ["2026-02-30"], ["Nov 2"], ["2026-11-2"], [""], [20261102]])("a malformed date %s", (bad) => {
    expect(reject({ profileId: "ledgerly", windowStart: bad, windowEnd: "2026-11-06" })).toBe("Dates must be real calendar dates written YYYY-MM-DD.");
    expect(reject({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: bad })).toBe("Dates must be real calendar dates written YYYY-MM-DD.");
  });

  it("a custom profile missing its summary", () => {
    const noSummary: Partial<CompanyProfile> = { ...custom };
    delete noSummary.summary;
    expect(reject({ customProfile: noSummary, ...week })).toBe("The company profile is incomplete or malformed: summary.");
  });

  it("a profileId that isn't a string", () => {
    expect(reject({ profileId: 5, ...week })).toBe("Unknown company profile. Pick one of the presets or send your own profile.");
  });

  it("a custom profile that isn't an object", () => {
    expect(reject({ customProfile: "acme", ...week })).toBe("The company profile is incomplete or malformed: it must be an object.");
  });

  it("a custom profile whose owner has no email", () => {
    const bad = { ...custom, areas: { safety: { description: "x", owner: { name: "Ann" } } } };
    expect(reject({ customProfile: bad, ...week })).toBe("The company profile is incomplete or malformed: areas.safety.owner.email.");
  });

  it("both a preset id and a custom profile, or neither", () => {
    expect(reject({ profileId: "ledgerly", customProfile: custom, ...week })).toBe("Send either a preset profileId or a customProfile, not both.");
    expect(reject({ ...week })).toBe("Send either a preset profileId or a customProfile.");
  });

  it.each([[null], ["text"], [[1, 2]], [42]])("a body that isn't an object: %s", (body) => {
    expect(reject(body)).toBe("Send a JSON object with a profile and a window.");
  });

  it("a missing window", () => {
    expect(reject({ profileId: "ledgerly" })).toBe("Dates must be real calendar dates written YYYY-MM-DD.");
  });
});
