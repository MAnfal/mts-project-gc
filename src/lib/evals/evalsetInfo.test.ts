import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { evalDirectory, weekLabel } from "./evalsetInfo";

describe("evalDirectory on the real config/", () => {
  it("names every manifest eval set by company, week and split", () => {
    const { evalsets, companyNames } = evalDirectory();
    expect(Object.keys(evalsets)).toHaveLength(12);
    expect(evalsets["skyhop_2026-10-26_2026-10-30"]).toEqual({
      company: "skyhop",
      companyName: "SkyHop Airlines",
      weekId: "2026-10-26_2026-10-30",
      week: "Oct 26–30",
      split: "dev",
    });
    expect(evalsets["cornercare_2026-11-02_2026-11-06"].split).toBe("test");
    // The example runs' preset companies are named too (the Runs page labels them).
    expect(companyNames.hearth).toBe("Hearth Home Appliances");
  });
});

describe("weekLabel", () => {
  it("writes a week inside one month as 'Oct 26–30'", () => {
    expect(weekLabel("2026-10-26", "2026-10-30")).toBe("Oct 26–30");
  });

  it("names both months across a month boundary", () => {
    expect(weekLabel("2026-10-30", "2026-11-03")).toBe("Oct 30–Nov 3");
  });
});

describe("evalDirectory on a broken copy of config/", () => {
  const cwd = process.cwd();
  let tmp = "";
  afterEach(() => {
    process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("throws naming the eval set whose company has no profile", async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "evalset-info-"));
    fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
    const manifest = path.join(tmp, "config/evalsets/manifest.yaml");
    const doc = YAML.parse(fs.readFileSync(manifest, "utf8")) as { evalsets: { id: string; company: string }[] };
    doc.evalsets[0].company = "nobody";
    fs.writeFileSync(manifest, YAML.stringify(doc));
    process.chdir(tmp);
    vi.resetModules();
    const fresh = await import("./evalsetInfo");
    expect(() => fresh.evalDirectory()).toThrow(`eval set ${doc.evalsets[0].id} names company nobody, which has no profile in config/companies`);
  });
});
