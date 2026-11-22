import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CompanySchema, companies, isPreset, presets } from "@/lib/config";
import { readYaml } from "@/lib/config/load";

// What the company file itself says, before CompanySchema fills any default.
const rawCompany = (id: string) =>
  readYaml(`companies/${id}.yaml`, z.looseObject({ use: z.string().optional() }));

describe("presets (the company profiles a GC can pick on the new-run screen)", () => {
  it("are exactly hearth and ledgerly, the use: demo companies", () => {
    expect(presets().map((c) => c.id)).toEqual(["hearth", "ledgerly"]);
  });

  it("never include an eval company, brightside among them", () => {
    const presetIds = presets().map((c) => c.id);
    const evalIds = companies()
      .filter((c) => c.use === "eval")
      .map((c) => c.id);
    expect(evalIds).toEqual(["brightside", "cornercare", "skyhop"]);
    for (const id of evalIds) expect(presetIds).not.toContain(id);
  });

  it("brightside.yaml tags itself use: eval in the file, not through the schema default", () => {
    expect(rawCompany("brightside").use).toBe("eval");
  });
});

describe("the preset filter", () => {
  it("rejects a company with no use field, and an eval company; accepts only demo", () => {
    expect(isPreset({})).toBe(false);
    expect(isPreset({ use: "eval" })).toBe(false);
    expect(isPreset({ use: "demo" })).toBe(true);
  });

  it("a profile file without a use field parses as eval, so it can never become a preset", () => {
    const { use: _ignored, ...noUse } = rawCompany("hearth");
    expect(_ignored).toBe("demo");
    const parsed = CompanySchema.parse(noUse);
    expect(parsed.use).toBe("eval");
    expect(isPreset(parsed)).toBe(false);
  });
});
