import { describe, expect, it } from "vitest";
import { shippedJson, shippedRuns, shippedSuiteIds } from "../evals/__fixtures__/shipped";
import { recordedView } from "./recorded-view";

// Every test here reads the real shipped bundle (public/evals), as the reviewer report and the examples build do.
// Constructed copies of a real record cover what no shipped run has: a dropped item and a malformed record.

type Rec = { id: string; status: string; config: { profileId: string; windowStart: string; windowEnd: string }; items?: unknown[]; error?: string };

const userViewIds = () => shippedJson<{ runId: string }[]>("user-view/runs-index.json").map((r) => r.runId);
const exampleRecord = (suffix: string) => shippedJson<Rec>(`user-view/runs/${userViewIds().find((id) => id.endsWith(suffix))!}.json`);

const LEDGERLY = "2026-11-21T19-22-35-758Z_pipeline_t6m4";
const names = { ledgerly: "Ledgerly Inc.", hearth: "Hearth Home Appliances" };

describe("recordedView over every shipped run", () => {
  const all: { where: string; rec: Rec }[] = [
    ...shippedSuiteIds().flatMap((s) => shippedRuns<Rec>(s).map((rec) => ({ where: s, rec }))),
    ...userViewIds().map((id) => ({ where: "user-view", rec: shippedJson<Rec>(`user-view/runs/${id}.json`) })),
  ];

  it("covers all 439 suite runs and all 22 example runs", () => {
    expect(all.filter((r) => r.where !== "user-view")).toHaveLength(439);
    expect(all.filter((r) => r.where === "user-view")).toHaveLength(22);
  });

  it("maps each one, keeping its items, tiers, owners and dates exactly as recorded", () => {
    for (const { rec } of all) {
      const v = recordedView(rec);
      expect(v.id).toBe(rec.id);
      expect(v.status).toBe(rec.status);
      expect(v.windowStart).toBe(rec.config.windowStart);
      expect(v.items).toEqual(rec.items ?? []);
    }
  });

  it("gives a failed run its recorded error and no items", () => {
    const failed = all.filter((r) => r.rec.status === "error");
    expect(failed.length).toBeGreaterThan(0);
    for (const { rec } of failed) {
      const v = recordedView(rec);
      expect(v.items).toEqual([]);
      expect(v.error).toBe(rec.error);
    }
  });
});

describe("recordedView on one example run", () => {
  it("names the company from the given names, and lists the stages in order with their counts", () => {
    const rec = exampleRecord("t6m4");
    expect(rec.id).toBe(LEDGERLY);
    const v = recordedView(rec, { companyNames: names });
    expect(v.company).toBe("Ledgerly Inc.");
    expect(v.items.map((i) => [i.document_number, i.tier, i.owner.email])).toEqual([
      ["2026-22685", "Medium", "sanctions@ledgerly.example"],
      ["2026-22686", "Medium", "sanctions@ledgerly.example"],
      ["2026-22687", "Medium", "sanctions@ledgerly.example"],
    ]);
    expect(v.stages[0]).toEqual({ name: "scan:federal-register", ms: 0, inCount: null, outCount: 466, note: null });
    expect(v.stages).toHaveLength(5);
    expect(v.scanned).toBe(466);
  });

  it("takes a custom profile's own name over any lookup", () => {
    expect(recordedView(exampleRecord("l14a"), { companyNames: { custom: "Wrong" } }).company).toBe("SmileBright Dental");
  });

  it("falls back to the profile id when no name is known", () => {
    expect(recordedView(exampleRecord("t6m4")).company).toBe("ledgerly");
  });

  it("turns a dropped item into a held-back note, titled from the week when the title is known (constructed copy)", () => {
    const rec = { ...exampleRecord("t6m4"), dropped: [{ document_number: "2026-22246", why: "The compliance date isn't in the published text." }, { document_number: "2026-99999", why: "x" }] };
    const titles: Record<string, string> = { "2026-22246": "Some Rule" };
    const v = recordedView(rec, { titleOf: (n) => titles[n] });
    expect(v.dropped).toEqual([
      { document_number: "2026-22246", title: "Some Rule", reason: "The compliance date isn't in the published text." },
      { document_number: "2026-99999", title: "2026-99999", reason: "x" },
    ]);
  });

  it("rejects a record that isn't a finished or failed run, naming the run and the field (constructed)", () => {
    expect(() => recordedView({ ...exampleRecord("t6m4"), status: "running" })).toThrow(/Recorded run 2026-11-21T19-22-35-758Z_pipeline_t6m4: status/);
    expect(() => recordedView({ id: "x" })).toThrow(/Recorded run x: /);
    expect(() => recordedView(null)).toThrow(/Recorded run \?: /);
  });

  it("rejects a done run whose item has no tier (constructed)", () => {
    const rec = exampleRecord("t6m4") as Rec & { items: Record<string, unknown>[] };
    const broken = { ...rec, items: [{ ...rec.items[0], tier: "Urgent" }] };
    expect(() => recordedView(broken)).toThrow(/items\.0\.tier/);
  });
});
