import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frozenWeek, getCompany, render, validateAll } from "../src/lib/config";
import { actionsPrompt, baselineTask, filterPrompt } from "../src/lib/prompts";
import { assignTier } from "../src/lib/tier";
import type { ActionItem, RunConfig } from "../src/lib/types";

// Prompts the arena actually sent on 2026-11-21 (copied from data/runs transcripts). If a config edit changes
// what the models see, these fail — on purpose: old and new runs would no longer be comparable.
const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/recorded-prompts.json"), "utf8"));

describe("config/", () => {
  it("every file parses and cross-references resolve", () => {
    expect(validateAll()).toEqual([]);
  });

  it("render fails loudly on a missing or an unused variable", () => {
    expect(render("a {{x}}", { x: 1 })).toBe("a 1");
    expect(() => render("a {{x}}", {})).toThrow(/\{\{x\}\} has no value/);
    expect(() => render("a", { x: 1 })).toThrow(/not used/);
  });
});

describe("prompts rebuilt from config/prompts.yaml match what the arena sent", () => {
  it("baseline task", () => {
    const cfg = recorded.baselineTask.config as RunConfig;
    expect(baselineTask(getCompany(cfg.profileId), cfg)).toBe(recorded.baselineTask.prompt);
  });

  it("LLM filter, first batch of the LLM-only run (from the frozen week input)", () => {
    const docs = frozenWeek("2026-11-09", "2026-11-13")!.slice(0, 20);
    expect(filterPrompt(getCompany("brightside"), docs)).toBe(recorded.filterPrompt0.prompt);
  });

  it("action writing", () => {
    expect(actionsPrompt(getCompany("brightside"), recorded.actionsPrompt.items as ActionItem[])).toBe(recorded.actionsPrompt.prompt);
  });
});

describe("every prompt builder renders (no placeholder drift between prompts.yaml and code)", () => {
  it("renders all 14 templates for a real company and doc", async () => {
    const P = await import("../src/lib/prompts");
    const co = getCompany("brightside");
    const doc = frozenWeek("2026-11-09", "2026-11-13")![0];
    const item = { document_number: doc.document_number, type: doc.type, title: doc.title, tier: "High" as const, tierReason: "r", owner: co.generalCounsel, reason: "why" };
    const out = [
      P.profileBrief(co),
      P.jevQuestion(),
      P.jevState(co, doc),
      P.filterSystem(co),
      P.filterPrompt(co, [doc]),
      P.extractSystem(),
      P.extractPrompt(doc, "text"),
      P.actionsSystem(),
      P.actionsPrompt(co, [item]),
      P.webLeadsSystem(),
      P.webLeadsPrompt(co, "2026-11-09", "2026-11-13"),
      P.baselineTask(co, { windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13" }),
      P.baselineFormat("task", "research"),
      P.judgeClarity([item]),
    ];
    expect(out).toHaveLength(14);
    for (const s of out) expect(s).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("arena configs built from setups.yaml match what the 2026-11-21 arena ran", () => {
  it("cellConfig reproduces every saved run config", async () => {
    const { cellByKey, cellConfig } = await import("../src/lib/arena");
    for (const saved of recorded.arenaConfigs as RunConfig[]) {
      const rebuilt = cellConfig(cellByKey(saved.cell!)!, saved, saved.arena!);
      expect(rebuilt).toEqual(saved);
    }
  });
});

describe("tier rules are passed in, not read from an editable file", () => {
  it("the window comes from the argument", () => {
    const deadlines = [{ date: "2026-12-13", kind: "comment" as const, source: "fr_field" as const, verified: true }];
    expect(assignTier({ type: "Proposed Rule", deadlines, asOf: "2026-11-13", rules: { criticalWindowDays: 90, recentlyEffectiveDays: 30 } }).tier).toBe("Critical");
    expect(assignTier({ type: "Proposed Rule", deadlines, asOf: "2026-11-13", rules: { criticalWindowDays: 20, recentlyEffectiveDays: 30 } }).tier).toBe("Medium");
  });
});

describe("frozen answer keys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("saveLabels refuses to overwrite a key with provenance, but writes a draft key", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cfg-"));
    fs.mkdirSync(path.join(dir, "evalsets/keys"), { recursive: true });
    const base = { profileId: "acme", windowStart: "2026-01-05", windowEnd: "2026-01-09", relevant: ["X"], reviewedAgencies: [], notes: {}, updatedAt: "" };
    fs.writeFileSync(path.join(dir, "evalsets/keys/acme_2026-01-05_2026-01-09.json"), JSON.stringify({ ...base, provenance: "frozen" }));
    vi.stubEnv("POC_CONFIG_DIR", dir);
    vi.resetModules();
    const { saveLabels, loadLabels } = await import("../src/lib/store");
    await expect(saveLabels({ ...base, relevant: [] })).rejects.toThrow(/frozen/);
    expect((await loadLabels("acme", "2026-01-05", "2026-01-09"))?.relevant).toEqual(["X"]);

    await saveLabels({ ...base, profileId: "draft" });
    expect((await loadLabels("draft", "2026-01-05", "2026-01-09"))?.relevant).toEqual(["X"]);
  });
});
