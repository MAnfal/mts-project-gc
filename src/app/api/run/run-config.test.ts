import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordedTrace } from "@/lib/pipeline/__fixtures__/replay";
import type { CompanyProfile, RunConfig } from "@/lib/types";
import { buildRunConfig } from "./run-config";

// The fields that decide what a run does. The rest of a recorded config (group, arena, cell, evalset, repeatIndex)
// only labels an eval-suite run.
const DECISION_FIELDS = ["profileId", "windowStart", "windowEnd", "asOf", "mode", "model", "filter", "jevThreshold", "webLeads", "promptSet", "filterVotes", "filterExcerpts", "customProfile"] as const;
const pick = (c: Partial<RunConfig>) => Object.fromEntries(DECISION_FIELDS.filter((k) => c[k] !== undefined).map((k) => [k, c[k]]));

describe("buildRunConfig", () => {
  it("builds the recorded live-setup run's decision fields (jev-sonnet-strict-passages, Brightside, Nov 2–6)", () => {
    const recorded = recordedTrace().find((e) => e.type === "run.start")!.config as RunConfig;
    expect(recorded.cell).toBe("jev-sonnet-strict-passages");
    const built = buildRunConfig({ profileId: recorded.profileId, windowStart: recorded.windowStart, windowEnd: recorded.windowEnd });
    expect(pick(built)).toEqual(pick(recorded));
    expect(Object.keys(built).sort()).toEqual(Object.keys(pick(recorded)).sort());
  });

  it("sets asOf to the window's end, never the wall clock", () => {
    expect(buildRunConfig({ profileId: "ledgerly", windowStart: "2026-11-09", windowEnd: "2026-11-13" }).asOf).toBe("2026-11-13");
  });

  it("runs a custom profile under profileId 'custom', carrying the profile itself", () => {
    const profile: CompanyProfile = {
      id: "acme",
      use: "demo",
      name: "Acme",
      summary: "Widgets",
      businessLines: [],
      applies: [],
      doesNotApply: [],
      areas: {},
      generalCounsel: { name: "G", email: "g@acme.example" },
    };
    const built = buildRunConfig({ customProfile: profile, windowStart: "2026-11-02", windowEnd: "2026-11-06" });
    expect(built.profileId).toBe("custom");
    expect(built.customProfile).toEqual(profile);
    const preset = buildRunConfig({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" });
    expect(pick({ ...built, profileId: "ledgerly", customProfile: undefined })).toEqual(pick(preset));
  });
});

// Broken copies of config/: experiment.yaml's userView.setup must name a pipeline setup whose method exists.
describe("buildRunConfig on a broken config", () => {
  let cwd: string | undefined;
  let tmp: string | undefined;
  afterEach(() => {
    if (cwd) process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    cwd = tmp = undefined;
  });
  async function withConfig(edit: (file: (rel: string) => string) => void) {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-config-"));
    fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
    edit((rel) => path.join(tmp!, "config", rel));
    process.chdir(tmp);
    vi.resetModules();
    return (await import("./run-config")).buildRunConfig;
  }
  const editYaml = (p: string, f: (doc: Record<string, unknown>) => void) => {
    const doc = YAML.parse(fs.readFileSync(p, "utf8"));
    f(doc);
    fs.writeFileSync(p, YAML.stringify(doc));
  };
  const req = { profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" };

  it("throws when userView.setup is not a setup", async () => {
    const build = await withConfig((file) => editYaml(file("experiment.yaml"), (d) => ((d.userView as { setup: string }).setup = "no-such-setup")));
    expect(() => build(req)).toThrow('experiment.yaml userView.setup "no-such-setup" is not a setup in setups.yaml');
  });

  it("throws when the setup's method is missing from setups.yaml methods", async () => {
    const build = await withConfig((file) =>
      editYaml(file("setups.yaml"), (d) => {
        d.methods = (d.methods as { id: string }[]).filter((m) => m.id !== "jev+llm");
      }),
    );
    expect(() => build(req)).toThrow('setups.yaml: setup "jev-sonnet-strict-passages" uses method "jev+llm", which is not listed under methods');
  });

  it("throws when userView.setup is a baseline (the live route runs only the pipeline)", async () => {
    const build = await withConfig((file) => editYaml(file("experiment.yaml"), (d) => ((d.userView as { setup: string }).setup = "baseline-sonnet")));
    expect(() => build(req)).toThrow('experiment.yaml userView.setup "baseline-sonnet" is not a pipeline setup');
  });
});
