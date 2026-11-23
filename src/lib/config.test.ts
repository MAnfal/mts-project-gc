import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { frozenWeek, getCompany, pipelineCfg, render, validateAll } from "./config";
import { actionsPrompt, baselineTask, filterPrompt } from "./prompts";
import { assignTier } from "./tier";
import type { ActionItem, RunConfig } from "./types";

// Prompts the arena actually sent on 2026-11-21 (copied from data/runs transcripts). If a config edit changes
// what the models see, these fail — on purpose: old and new runs would no longer be comparable.
const recorded = JSON.parse(fs.readFileSync(path.join(__dirname, "__fixtures__/recorded-prompts.json"), "utf8"));

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
    const P = await import("./prompts");
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
    ];
    expect(out).toHaveLength(13);
    for (const s of out) expect(s).not.toMatch(/\{\{\w+\}\}/);
  });
});

describe("tier rules are passed in, not read from an editable file", () => {
  const R = { criticalWindowDays: 90, recentlyEffectiveDays: 30, criticalDocTypes: ["Rule", "Proposed Rule"] as ("Rule" | "Proposed Rule" | "Notice")[] };
  const deadlines = [{ date: "2026-12-13", kind: "comment" as const, source: "fr_field" as const, verified: true }];

  it("the window comes from the argument", () => {
    expect(assignTier({ type: "Proposed Rule", deadlines, asOf: "2026-11-13", rules: R }).tier).toBe("Critical");
    expect(assignTier({ type: "Proposed Rule", deadlines, asOf: "2026-11-13", rules: { ...R, criticalWindowDays: 20 } }).tier).toBe("Medium");
  });

  it("which doc types can be Critical is a config switch (notices capped at Medium unless listed)", () => {
    expect(assignTier({ type: "Notice", deadlines, asOf: "2026-11-13", rules: R }).tier).toBe("Medium");
    expect(assignTier({ type: "Notice", deadlines, asOf: "2026-11-13", rules: { ...R, criticalDocTypes: ["Rule", "Proposed Rule", "Notice"] } }).tier).toBe("Critical");
  });

  it("pipeline.yaml carries the switch", () => {
    expect(pipelineCfg().tiering.criticalDocTypes).toEqual(["Rule", "Proposed Rule"]);
  });
});
