// Record one improvement iteration: the story (hypothesis, change, decision) + measured results + config snapshot.
//   npx tsx scripts/iteration.mts <data/iterations/<id>/spec.yaml>
// spec.yaml (hand-written): { id, title, date, suite, setup, comparedTo?, hypothesis, change, codeChanges?, evalChanges?, decision, notes? }
// Writes iteration.yaml next to it (spec + results computed from the suite) and config/ (snapshot of live config), plus:
//   system.diff — the candidate setup's EFFECTIVE config vs the comparedTo setup's, taken from their traces' run.start
//                 (prompts after prompt-set overrides, pipeline knobs, model, method): exactly what ran differently.
//   config.diff — everything that changed in config/ since the previous iteration's snapshot (incl. grader/eval fixes).
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { arenaRuns } from "../src/lib/arena";
import { CONFIG_DIR, configHash } from "../src/lib/config";
import { suiteReport } from "../src/lib/suite";
import { readTrace } from "../src/lib/trace";
import { execFileSync } from "node:child_process";

const specPath = process.argv[2];
// --keep-snapshot: re-grade an existing iteration (e.g. after a grader fix) without replacing the config it ran with.
const keepSnapshot = process.argv.includes("--keep-snapshot");
const dir = path.dirname(specPath);
const spec = YAML.parse(fs.readFileSync(specPath, "utf8")) as { id: string; suite: string; setup: string; comparedTo?: string } & Record<string, unknown>;
const report = suiteReport(await arenaRuns(spec.suite));
const pick = (key: string) => {
  const s = report.setups.find((x) => x.key === key);
  if (!s) throw new Error(`setup ${key} not in ${spec.suite}`);
  const sl = (k: string) => (s.slices[k] ? `${s.slices[k].correct}/${s.slices[k].total}` : null);
  const r2 = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 1000);
  return {
    setup: key,
    label: s.label,
    runs: s.graded,
    recall: r2(s.metrics.recall),
    precision: r2(s.metrics.precision),
    trapAvoidance: r2(s.metrics.trapAvoidance),
    datesRight: r2(s.metrics.datesRight),
    judgePass: r2(s.metrics.judgePass),
    consistency: r2(s.metrics.consistency),
    score: r2(s.score),
    perRun: Object.fromEntries(Object.entries(s.countsPerRun).map(([k, v]) => [k, Math.round(v * 100) / 100])),
    devCasesRight: sl("split:dev"),
    testCasesRight: sl("split:test"),
    costPerRunUsd: Math.round(s.costPerRun * 1000) / 1000,
    secondsPerRun: s.msMean === null ? null : Math.round(s.msMean / 1000),
  };
};
const results = { candidate: pick(spec.setup), ...(spec.comparedTo ? { comparedTo: pick(spec.comparedTo) } : {}) };

// Unified diff of two texts via git (off-the-shelf; exit code 1 just means "different").
function unifiedDiff(a: string, b: string, labelA: string, labelB: string): string {
  const tmp = fs.mkdtempSync(path.join(dir, ".diff-"));
  const fa = path.join(tmp, "a");
  const fb = path.join(tmp, "b");
  fs.writeFileSync(fa, a);
  fs.writeFileSync(fb, b);
  try {
    execFileSync("git", ["diff", "--no-index", "--no-color", "--src-prefix=", "--dst-prefix=", fa, fb], { encoding: "utf8" });
    return "";
  } catch (e) {
    return String((e as { stdout?: string }).stdout ?? "").replaceAll(fa, labelA).replaceAll(fb, labelB);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// 1. System diff: effective config of candidate vs comparedTo, from run.start in their traces.
const runs = await arenaRuns(spec.suite);
const effective = (setup: string) => {
  const r = runs.find((x) => x.config.cell === setup && x.status === "done");
  const start = r ? (readTrace(r.id).find((e) => e.type === "run.start") as Record<string, unknown> | undefined) : undefined;
  if (!start) return null;
  const cfg = start.config as Record<string, unknown>;
  const pick = { model: cfg.model, mode: cfg.mode, filter: cfg.filter, jevThreshold: cfg.jevThreshold, filterVotes: cfg.filterVotes ?? 1, webLeads: cfg.webLeads, promptSet: start.promptSet ?? "default", jevModel: start.jevModel, pipeline: start.pipeline, prompts: start.prompts };
  return YAML.stringify(pick, { lineWidth: 0, blockQuote: "literal" });
};
let systemChanges: string[] = [];
if (spec.comparedTo) {
  const a = effective(spec.comparedTo);
  const b = effective(spec.setup);
  if (a && b) {
    const d = unifiedDiff(a, b, `${spec.comparedTo} (effective config)`, `${spec.setup} (effective config)`);
    fs.writeFileSync(path.join(dir, "system.diff"), d || "# no difference in effective configuration\n");
    const changed = (txt: string) => new Map(Object.entries(YAML.parse(txt) as Record<string, unknown>).map(([k, v]) => [k, JSON.stringify(v)]));
    const ma = changed(a);
    const mb = changed(b);
    systemChanges = [...new Set([...ma.keys(), ...mb.keys()])].filter((k) => ma.get(k) !== mb.get(k)).flatMap((k) => {
      if (k !== "prompts") return [k];
      const pa = (YAML.parse(a) as { prompts: Record<string, string> }).prompts;
      const pb = (YAML.parse(b) as { prompts: Record<string, string> }).prompts;
      return Object.keys({ ...pa, ...pb }).filter((p) => pa[p] !== pb[p]).map((p) => `prompts.${p}`);
    });
  }
}

// 2. Config diff vs the previous iteration's snapshot (folders sort by their NN- prefix). Both sides exclude the frozen
//    week inputs (large, never edited), so the diff shows only settings, prompts, setups, judges and keys.
const snapFilter = (src: string) => !src.includes(`${path.sep}weeks${path.sep}`) && !src.endsWith(`${path.sep}weeks`);
const itersDir = path.dirname(dir);
const prev = fs.readdirSync(itersDir).filter((d) => d < path.basename(dir) && fs.existsSync(path.join(itersDir, d, "config"))).sort().at(-1);
let configChanges: string[] = [];
if (prev && !keepSnapshot) {
  const prevCfg = path.join(itersDir, prev, "config");
  const nowCfg = fs.mkdtempSync(path.join(dir, ".now-"));
  fs.cpSync(CONFIG_DIR, nowCfg, { recursive: true, filter: snapFilter });
  const git = (args: string[]) => {
    try {
      execFileSync("git", ["diff", "--no-index", "--no-color", ...args, prevCfg, nowCfg], { encoding: "utf8" });
      return "";
    } catch (e) {
      return String((e as { stdout?: string }).stdout ?? "");
    }
  };
  const clean = (t: string) => t.replaceAll(prevCfg, `${prev}/config`).replaceAll(nowCfg, "config");
  const full = clean(git([]));
  fs.writeFileSync(path.join(dir, "config.diff"), full || `# no config changes since ${prev}\n`);
  configChanges = clean(git(["--name-only"])).split("\n").filter(Boolean).map((f) => f.replace(/^.*?config\//, ""));
  fs.rmSync(nowCfg, { recursive: true, force: true });
}
// Code isn't in config/, so record which commit the iteration was measured on (+ whether src/ had uncommitted edits).
const git = (args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
const code = { commit: git(["rev-parse", "--short", "HEAD"]), uncommittedSrcChanges: git(["status", "--porcelain", "--", "src", "scripts"]).split("\n").filter(Boolean).length };
const out = { ...spec, results, code, systemChanges, configChangesSincePrevious: { previous: prev ?? null, files: configChanges }, configHashAtRecord: configHash(), recordedAt: new Date().toISOString() };
fs.writeFileSync(path.join(dir, "iteration.yaml"), `# Generated by scripts/iteration.mts from spec.yaml — edit spec.yaml, then re-run.\n${YAML.stringify(out, { lineWidth: 0 })}`);
if (!keepSnapshot || !fs.existsSync(path.join(dir, "config"))) {
  fs.rmSync(path.join(dir, "config"), { recursive: true, force: true });
  fs.cpSync(CONFIG_DIR, path.join(dir, "config"), { recursive: true, filter: snapFilter });
}
console.log(`recorded ${spec.id}: ${results.candidate.label} recall ${results.candidate.recall} precision ${results.candidate.precision} score ${results.candidate.score}`);
