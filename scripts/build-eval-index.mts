// Derives the generated files of the eval bundle (public/evals) from the files already in it, using the
// POC's own grading code, unmodified, imported from a checkout of the `poc` branch.
//
//   <poc>/node_modules/.bin/tsx scripts/build-eval-index.mts --bundle <dir> --poc <dir> --commit <sha> [--check]
//
// Normally run by scripts/build-eval-bundle.sh (build) and scripts/verify-eval-bundle.sh (--check), which
// pass the POC worktree's own tsx so the POC modules resolve their own dependencies.
//
// It reads only the bundle: runs from suites/*/runs.jsonl.gz, traces from suites/*/traces/ (for the POC's
// trace checks), and keys + manifest from config/ (POC_CONFIG_DIR). So the numbers it writes are a
// recomputation from what ships, not a copy of anything the POC printed. Writes (or, with --check, compares
// byte for byte against what is there and exits 1 on any difference):
//   index.json                         suites, setups, iterations (each with its measured candidate and
//                                      comparedTo, and which evidence files exist), live, baseline,
//                                      suiteResults (every setup in every suite), noiseBand, evalSet, counts
//   iterations/<id>/iteration.json     spec.yaml merged with iteration.yaml (07-next: evidence only)
//   user-view/index.json               one row per example run, failed ones included
// and checks that suites/<id>/report.json equals suiteReport() over that suite's shipped runs.
//
// Build mode also takes --poc-data <dir>: any run record on `poc` that export.mts did not put into a suite's
// runs.jsonl.gz is appended with `superseded: true`, so nothing recorded is dropped. And
// --previous-manifests <dir> (<suiteId>.json copies saved before the rebuild): a suite's previous
// manifest.json is kept when export.mts's `exportedAt` is the only change, so rebuilds are byte-stable.
// The decisions themselves live in src/lib/evals/bundle-build.ts, tested by vitest.
//
// No model is ever called. The POC's gateway module refuses to load without a key, so the key is set to a
// dummy value: if anything tried to call a model, the call would fail on auth instead of spending money.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import YAML from "yaml";
import {
  appendSkippedRuns,
  keepManifest,
  keyTotals,
  metricOf,
  noiseBand,
  pickBaselineSetup,
  poolSetupRuns,
  repeatAgreement,
  runCountsOf,
  type AgreementCounts,
  type AnswerKey,
  type SetupReport,
} from "../src/lib/evals/bundle-build";
import { EvalIndexSchema, METRICS, SPLITS, UserViewIndexSchema, type EvalIndex, type Split } from "../src/lib/evals/index-schema";

// ── Which runs the headline numbers pool ──
// Live: the live setup (config/experiment.yaml → userView.setup) over both iteration-06 suites: the suite
// that promoted it and its unchanged replicate (data/iterations/06-passages/spec.yaml → suite, notes).
const LIVE_SUITES = ["arena-2026-11-21-22-52-l92", "arena-2026-11-21-23-16-du8"];
// Baseline: no single suite ran it on all four weeks (w0i ran the November weeks, cb0 the October ones), so
// both are pooled to cover the same 12 company-weeks as the live numbers.
const BASELINE_SUITES = ["arena-2026-11-21-18-40-w0i", "arena-2026-11-21-21-45-cb0"];
const USER_VIEW_RUNS = "user-view/runs";

// ── Minimal shapes of what this script reads from the POC (types.ts RunRecord, suite.ts suiteReport) ──
type Run = {
  id: string;
  createdAt: string;
  status: "running" | "done" | "error";
  configHash?: string;
  superseded?: boolean;
  items?: { document_number: string; tier: string }[];
  /** Judge-panel verdicts; the POC judges only the first repeat of each eval set (arena.ts). */
  panel?: unknown;
  config: { profileId: string; windowStart: string; windowEnd: string; evalset?: string; cell?: string; arena?: string };
};
type SuiteReport = { setups: SetupReport[] };
type EvalSet = { id: string; company: string; windowStart: string; split: "dev" | "test"; weekId: string };
type SetupResult = EvalIndex["live"];
type Poc = {
  suiteReport: (runs: Run[]) => SuiteReport;
  evalsets: () => EvalSet[];
  experiment: () => { userView: { setup: string } };
  setups: () => { setups: { id: string; method: string }[] };
};

function args() {
  const a = process.argv.slice(2);
  const val = (k: string) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : undefined;
  };
  const bundle = val("--bundle");
  const poc = val("--poc");
  const commit = val("--commit");
  if (!bundle || !poc || !commit)
    throw new Error("usage: build-eval-index.mts --bundle <dir> --poc <dir> --commit <sha> [--poc-data <dir>] [--previous-manifests <dir>] [--check]");
  return {
    bundle: path.resolve(bundle),
    poc: path.resolve(poc),
    commit,
    pocData: val("--poc-data"),
    previousManifests: val("--previous-manifests"),
    check: a.includes("--check"),
  };
}

const readGzLines = (file: string): Run[] =>
  zlib
    .gunzipSync(fs.readFileSync(file))
    .toString("utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Run);
const writeGzLines = (file: string, runs: Run[]) => fs.writeFileSync(file, zlib.gzipSync(runs.map((r) => JSON.stringify(r)).join("\n") + "\n", { level: 9 }));
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Build mode: append raw run records that export.mts's arenaRuns() left out, flagged superseded. Returns the count added per suite. */
function keepSkippedRuns(bundle: string, pocData: string, suiteIds: string[]): Record<string, number> {
  const added: Record<string, number> = {};
  for (const id of suiteIds) {
    const gz = path.join(bundle, "suites", id, "runs.jsonl.gz");
    const dir = path.join(pocData, "evals", id, "runs");
    const raw = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Run);
    const { runs, added: n } = appendSkippedRuns(readGzLines(gz), raw);
    added[id] = n;
    if (n) writeGzLines(gz, runs);
  }
  return added;
}

/** A data/ view for the POC code: data/evals/<suite>/traces → the bundle's traces, so its trace checks read shipped bytes. */
function dataView(bundle: string, suiteIds: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eval-index-"));
  for (const id of suiteIds) {
    fs.mkdirSync(path.join(dir, "data", "evals", id), { recursive: true });
    fs.symlinkSync(path.join(bundle, "suites", id, "traces"), path.join(dir, "data", "evals", id, "traces"));
  }
  return dir;
}

async function loadPoc(pocDir: string, configDir: string): Promise<Poc> {
  process.env.POC_CONFIG_DIR = configDir;
  process.env.VERCEL_AI_GATEWAY_API_KEY = "offline-no-model-calls";
  process.env.AI_GATEWAY_API_KEY = "offline-no-model-calls";
  const suite = await import(path.join(pocDir, "src/lib/suite.ts"));
  const config = await import(path.join(pocDir, "src/lib/config.ts"));
  return { suiteReport: suite.suiteReport, evalsets: config.evalsets, experiment: config.experiment, setups: config.setups };
}

/** Which runs suiteReport receives, mirroring export.mts: everything arenaRuns() returned, nothing appended here. */
const graded = (runs: Run[]) => runs.filter((r) => !r.superseded);

/**
 * One setup's results over the named suites, per split, as suiteReport computes them, plus agreement across
 * repeats. `evalsetIds` are the eval sets the pooled runs must cover (all 12 for live and baseline; the suite's
 * own for a single suite). A split the runs never touch is null over 0 runs.
 */
function setupResult(poc: Poc, setup: string, suites: string[], runsOf: (id: string) => Run[], evalsetIds: string[], keyOf: (evalset: string) => AnswerKey | null): SetupResult {
  const sets = poc.evalsets();
  const evalsetOf = (r: Run) => r.config.evalset ?? sets.find((e) => e.company === r.config.profileId && e.windowStart === r.config.windowStart)?.id;
  const splitOfSet = (id: string | undefined) => sets.find((e) => e.id === id)?.split;
  const pooled = poolSetupRuns(setup, suites, (id) => graded(runsOf(id)), evalsetIds);

  const per = (split: Split) => {
    const runs = split === "all" ? pooled : pooled.filter((r) => splitOfSet(evalsetOf(r)) === split);
    if (!runs.length) return { s: null, panelRuns: 0 };
    const s = poc.suiteReport(runs).setups.find((x) => x.key === setup);
    if (!s) throw new Error(`suiteReport has no ${setup} row for split ${split}`);
    // panelSummary pools the verdicts of finished runs, but only first-repeat runs carry a panel.
    return { s, panelRuns: runs.filter((r) => r.status === "done" && r.panel).length };
  };
  const reports = { all: per("all"), dev: per("dev"), test: per("test") };
  const agreement = repeatAgreement(pooled, keyOf, (e) => {
    const split = splitOfSet(e);
    if (!split) throw new Error(`eval set ${e} is not in the manifest`);
    return split;
  });
  const ratio = (c: AgreementCounts, which: "relevance" | "tier", sp: Split) => {
    const { numerator, denominator } = c[which];
    return { value: denominator ? numerator / denominator : null, numerator, denominator, split: sp, runs: c.runs, suite: suites };
  };
  const bySplit = <T,>(f: (sp: Split) => T) => Object.fromEntries(SPLITS.map((sp) => [sp, f(sp)])) as Record<Split, T>;
  const metrics = Object.fromEntries(METRICS.map((m) => [m, bySplit((sp) => ({ ...metricOf(reports[sp], m), split: sp, suite: suites }))]));
  const label = reports.all.s?.label;
  if (!label) throw new Error(`no ${setup} runs in ${suites.join(", ")}`);
  return {
    setup,
    label,
    suite: suites,
    runCounts: bySplit((sp) => runCountsOf(reports[sp].s)),
    ...metrics,
    relevanceAgreement: bySplit((sp) => ratio(agreement[sp], "relevance", sp)),
    tierAgreement: bySplit((sp) => ratio(agreement[sp], "tier", sp)),
  } as SetupResult;
}

function iterationFiles(bundle: string) {
  const root = path.join(bundle, "iterations");
  const out: { id: string; record: Record<string, unknown>; summary: Omit<EvalIndex["iterations"][number], "measured"> }[] = [];
  for (const id of fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory()).sort()) {
    const yaml = (f: string) => {
      const p = path.join(root, id, f);
      return fs.existsSync(p) ? (YAML.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>) : null;
    };
    const spec = yaml("spec.yaml");
    const it = yaml("iteration.yaml");
    const evidenceOnly = !spec && !it;
    // iteration.yaml is generated from spec.yaml plus results; where both have a field, iteration.yaml wins.
    const record = evidenceOnly ? { id, evidenceOnly: true } : { ...spec, ...it, evidenceOnly: false };
    const str = (k: string) => (typeof record[k as keyof typeof record] === "string" ? (record[k as keyof typeof record] as string) : null);
    const results = (record as Record<string, unknown>).results;
    out.push({
      id,
      record,
      summary: {
        id,
        title: str("title"),
        date: str("date"),
        decision: str("decision"),
        setup: str("setup"),
        comparedTo: str("comparedTo"),
        suite: str("suite"),
        results: results && typeof results === "object" ? (results as Record<string, unknown>) : null,
        evidenceOnly,
        evidence: {
          systemDiff: fs.existsSync(path.join(root, id, "system.diff")),
          configDiff: fs.existsSync(path.join(root, id, "config.diff")),
          errorAnalysis: fs.existsSync(path.join(root, id, "error-analysis.json")),
        },
      },
    });
  }
  return out;
}

function userViewIndex(bundle: string) {
  const dir = path.join(bundle, USER_VIEW_RUNS);
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Run;
      return {
        id: r.id,
        profileId: r.config.profileId,
        window: { start: r.config.windowStart, end: r.config.windowEnd },
        status: r.status,
        items: Array.isArray(r.items) ? r.items.length : null,
        setup: r.config.cell ?? null,
      };
    });
}

async function main() {
  const { bundle, poc: pocDir, commit, pocData, previousManifests, check } = args();
  const suiteIds = fs
    .readdirSync(path.join(bundle, "suites"))
    .filter((d) => fs.statSync(path.join(bundle, "suites", d)).isDirectory())
    .sort();

  if (!check && pocData) {
    const added = keepSkippedRuns(bundle, path.resolve(pocData), suiteIds);
    const total = Object.values(added).reduce((a, b) => a + b, 0);
    console.log(`superseded runs kept: ${total}${total ? " " + JSON.stringify(added) : ""}`);
  }
  if (!check && previousManifests) {
    let kept = 0;
    for (const id of suiteIds) {
      const prevFile = path.join(previousManifests, `${id}.json`);
      const file = path.join(bundle, "suites", id, "manifest.json");
      const next = fs.readFileSync(file, "utf8");
      const body = keepManifest(fs.existsSync(prevFile) ? fs.readFileSync(prevFile, "utf8") : null, next);
      if (body !== next) kept++;
      fs.writeFileSync(file, body);
    }
    console.log(`manifest.json kept where only exportedAt changed: ${kept} of ${suiteIds.length}`);
  }

  const poc = await loadPoc(pocDir, path.join(bundle, "config"));
  const cache = new Map<string, Run[]>();
  const runsOf = (id: string) => {
    if (!cache.has(id)) cache.set(id, readGzLines(path.join(bundle, "suites", id, "runs.jsonl.gz")));
    return cache.get(id)!;
  };
  const view = dataView(bundle, suiteIds);
  process.chdir(view);

  const files = new Map<string, string>();
  const problems: string[] = [];

  // Per-suite reports: suiteReport over the shipped runs must reproduce what export.mts wrote.
  const sets = poc.evalsets();
  const suites = suiteIds.map((id) => {
    const runs = runsOf(id);
    const report = poc.suiteReport(graded(runs));
    const shippedReport = fs.readFileSync(path.join(bundle, "suites", id, "report.json"), "utf8");
    if (JSON.stringify(report, null, 2) !== shippedReport) problems.push(`suites/${id}/report.json differs from suiteReport() over the shipped runs`);
    const evalsetIds = uniq(runs.map((r) => r.config.evalset).filter((x): x is string => !!x)).sort();
    const weeks = uniq(evalsetIds.map((e) => sets.find((s) => s.id === e)).filter((e): e is EvalSet => !!e).map((e) => `${e.weekId}|${e.split}`))
      .sort()
      .map((w) => ({ id: w.split("|")[0], split: w.split("|")[1] as "dev" | "test" }));
    return {
      id,
      createdAt: runs.map((r) => r.createdAt).sort()[0],
      runs: runs.length,
      traces: fs.readdirSync(path.join(bundle, "suites", id, "traces")).filter((f) => f.endsWith(".jsonl.gz")).length,
      failed: runs.filter((r) => r.status === "error").length,
      superseded: runs.filter((r) => r.superseded).length,
      configHashes: uniq(runs.map((r) => r.configHash).filter((x): x is string => !!x)).sort(),
      weeks,
      evalsets: evalsetIds,
      setups: report.setups.map((s) => ({ key: s.key, label: s.label, runs: s.runs, finished: s.finished, failed: s.failed, graded: s.graded })),
      _report: report,
    };
  });

  const setupInfo = new Map<string, EvalIndex["setups"][number]>();
  for (const s of suites)
    for (const x of s._report.setups) {
      const prev = setupInfo.get(x.key);
      if (prev) prev.suites.push(s.id);
      else setupInfo.set(x.key, { key: x.key, label: x.label, model: x.model, modelLabel: x.modelLabel, method: x.method, promptSet: x.config?.promptSet ?? null, suites: [s.id] });
    }

  const liveSetup = poc.experiment().userView.setup;
  const baselineSetup = pickBaselineSetup(poc.setups().setups);
  const keysDir = path.join(bundle, "config", "evalsets", "keys");
  const keyOf = (evalset: string): AnswerKey | null => {
    const f = path.join(keysDir, `${evalset}.json`);
    return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as AnswerKey) : null;
  };
  const allEvalsets = sets.map((e) => e.id);
  const suiteEvalsets = (id: string) => suites.find((s) => s.id === id)!.evalsets;
  const ranIn = (setup: string, suite: string) => suites.find((s) => s.id === suite)!._report.setups.some((x) => x.key === setup);
  const inSuite = (setup: string, suite: string) => setupResult(poc, setup, [suite], runsOf, suiteEvalsets(suite), keyOf);

  const iterations = iterationFiles(bundle);
  const measured = (it: (typeof iterations)[number]["summary"]) => {
    if (it.evidenceOnly) return null;
    if (!it.setup || !it.suite) throw new Error(`iteration ${it.id} has no setup or suite`);
    return { candidate: inSuite(it.setup, it.suite), comparedTo: it.comparedTo ? inSuite(it.comparedTo, it.suite) : null };
  };
  // Noise: the setup the live iteration replaced, re-run unchanged in both live suites.
  const control = iterations.find((i) => i.summary.setup === liveSetup)?.summary.comparedTo ?? null;
  const [la, lb] = LIVE_SUITES;
  const band =
    control === null
      ? null
      : noiseBand(control, ranIn(control, la) ? inSuite(control, la) : null, ranIn(control, lb) ? inSuite(control, lb) : null);
  const keys = allEvalsets.map((e) => {
    const k = keyOf(e);
    if (!k) throw new Error(`no answer key for eval set ${e}`);
    return k;
  });
  for (const it of iterations) files.set(`iterations/${it.id}/iteration.json`, json(it.record));
  const uv = UserViewIndexSchema.parse(userViewIndex(bundle));
  files.set("user-view/index.json", json(uv));

  const index = EvalIndexSchema.parse({
    schemaVersion: 1,
    source: { branch: "poc", commit },
    suites: suites.map((s) => {
      const { _report, ...rest } = s;
      void _report;
      return rest;
    }),
    setups: [...setupInfo.values()],
    iterations: iterations.map((i) => ({ ...i.summary, measured: measured(i.summary) })),
    live: setupResult(poc, liveSetup, LIVE_SUITES, runsOf, allEvalsets, keyOf),
    baseline: setupResult(poc, baselineSetup, BASELINE_SUITES, runsOf, allEvalsets, keyOf),
    suiteResults: suites.flatMap((s) => s._report.setups.map((x) => inSuite(x.key, s.id))),
    noiseBand: band,
    evalSet: {
      companies: uniq(sets.map((e) => e.company)).length,
      weeks: {
        dev: uniq(sets.filter((e) => e.split === "dev").map((e) => e.weekId)).length,
        test: uniq(sets.filter((e) => e.split === "test").map((e) => e.weekId)).length,
      },
      evalsets: sets.length,
      ...keyTotals(keys),
    },
    counts: {
      suites: suites.length,
      runs: suites.reduce((a, s) => a + s.runs, 0),
      traces: suites.reduce((a, s) => a + s.traces, 0),
      userViewRuns: uv.length,
      iterations: iterations.length,
    },
  });
  files.set("index.json", json(index));

  for (const [rel, body] of files) {
    const p = path.join(bundle, rel);
    if (check) {
      const shipped = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      if (shipped === null) problems.push(`${rel} is missing`);
      else if (shipped !== body) problems.push(`${rel} differs from the recomputation over the shipped bundle`);
    } else {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
    }
  }
  fs.rmSync(view, { recursive: true, force: true });

  const live = index.live;
  console.log(
    `live ${live.setup} over ${live.suite.join(" + ")}: recall ${live.recall.all.value} (${live.recall.all.runs} graded of ${live.runCounts.all.total} runs)`,
  );
  const ra = live.relevanceAgreement.all;
  console.log(`live relevance agreement: ${ra.numerator}/${ra.denominator} keyed docs over ${ra.runs} runs`);
  if (problems.length) {
    for (const p of problems) console.error(`FAIL: ${p}`);
    process.exit(1);
  }
  console.log(check ? `index check: ${files.size} generated files match` : `wrote ${files.size} generated files`);
}

await main();
