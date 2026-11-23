import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { buildRunConfig } from "@/app/api/run/run-config";
import { experiment, setups } from "@/lib/config";
import { liveSetupView } from "./liveSetup";

// The real config/: the page must show exactly what a GC's run executes.
const cfg = (rel: string) => YAML.parse(fs.readFileSync(path.join(process.cwd(), "config", rel), "utf8"));

describe("liveSetupView (the /evals/setup page's data)", () => {
  it("is the setup user runs execute: experiment.yaml userView.setup, with buildRunConfig's decision fields", async () => {
    const v = await liveSetupView();
    const run = buildRunConfig({ profileId: "ledgerly", windowStart: "2026-11-09", windowEnd: "2026-11-13" });
    expect(v.setup.id).toBe(experiment().userView.setup);
    expect(v.setup.label).toBe(setups().setups.find((s) => s.id === v.setup.id)!.label);
    expect(v.model.id).toBe(run.model);
    expect(v.model.label).toBe(setups().models.find((m) => m.id === run.model)!.label);
    expect(v.filter).toBe(run.filter);
    expect(v.jevThreshold).toBe(run.jevThreshold);
    expect(v.promptSet).toBe(run.promptSet ?? null);
    expect(v.filterExcerpts).toEqual(run.filterExcerpts ?? null);
    expect(v.filterVotes).toBe(run.filterVotes ?? 1);
    expect(v.webLeads).toBe(run.webLeads);
    expect(v.jevModel).toBe(experiment().jevModel);
  });

  it("lists the prompts the live method runs, by stage, and none it doesn't (baseline, web leads, judges)", async () => {
    const v = await liveSetupView();
    expect(v.stages.map((s) => s.id)).toEqual(["screen", "filter", "extract", "actions"]);
    expect(v.stages.flatMap((s) => s.prompts.map((p) => p.name))).toEqual([
      "jevQuestion", "jevState", "filterSystem", "filterPrompt", "extractSystem", "extractPrompt", "actionsSystem", "actionsPrompt",
    ]);
  });

  it("shows the prompt set's override in full, next to the default it replaced; other prompts are the defaults", async () => {
    const v = await liveSetupView();
    const base = cfg("prompts.yaml");
    const set = cfg(`prompt-sets/${v.promptSet}.yaml`);
    const all = v.stages.flatMap((s) => s.prompts);
    const filterSystem = all.find((p) => p.name === "filterSystem")!;
    expect(filterSystem.text).toBe(set.filterSystem);
    expect(filterSystem.defaultText).toBe(base.filterSystem);
    for (const p of all.filter((x) => x.name !== "filterSystem")) {
      expect(p.text).toBe(base[p.name]);
      expect(p.defaultText).toBeNull();
    }
  });

  it("carries the code-assigned tier rules from pipeline.yaml", async () => {
    expect((await liveSetupView()).tiering.criticalWindowDays).toBe(cfg("pipeline.yaml").tiering.criticalWindowDays);
  });
});
