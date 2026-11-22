import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readYaml } from "./config/load";
import type { CompanyProfile, FrDoc, LabelSet } from "./types";

/**
 * Everything tunable lives in config/ (YAML for what people edit, JSON for data). This module only
 * reads and validates it; the rest of the code executes it. Files are re-read when they change on disk
 * (mtime check), so editing a YAML takes effect without a restart.
 *
 * Ported from poc:poc/src/lib/config.ts. Schemas and every decision-path function are unchanged; YAML now
 * loads through readYaml, the directory is always config/ under the working directory, and the eval-suite
 * pinning (pinConfig/unpinConfig) is gone because nothing in the demo runs a suite.
 */
// Statically scoped to config/ so the bundler traces that folder only (see readYaml).
const configPath = (rel = "") => path.join(process.cwd(), "config", rel);

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be a quoted YYYY-MM-DD string");
const owner = z.object({ name: z.string(), email: z.string() });

export const CompanySchema = z.object({
  id: z.string(),
  /** eval = used in eval sets (frozen, interviewer view). demo = held out, only offered in the user view. */
  use: z.enum(["eval", "demo"]).default("eval"),
  name: z.string(),
  summary: z.string(),
  businessLines: z.array(z.string()),
  applies: z.array(z.string()),
  doesNotApply: z.array(z.string()),
  areas: z.record(z.string(), z.object({ description: z.string(), owner })),
  generalCounsel: owner,
});

const SearchKind = z.enum(["anthropic-native", "openai-native", "google-native", "exa"]);
const SetupsSchema = z.object({
  models: z.array(z.object({ id: z.string(), label: z.string(), vendor: z.string(), search: SearchKind })).min(1),
  methods: z
    .array(
      z.object({
        id: z.enum(["jev+llm", "llm", "baseline"]),
        label: z.string(),
        estUsd: z.number().positive(),
        mode: z.enum(["pipeline", "baseline"]),
        filter: z.enum(["jev+llm", "llm", "jev"]).optional(),
        jevThreshold: z.number().min(0).max(1).optional(),
        webLeads: z.boolean().optional(),
      }),
    )
    .min(1),
  /** The setups the eval suite runs. Each = one model + one method. */
  setups: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]+$/),
        label: z.string(),
        model: z.string(),
        method: z.enum(["jev+llm", "llm", "baseline"]),
        /** Optional prompt set (config/prompt-sets/<name>.yaml) overriding some prompts for this setup only. */
        promptSet: z.string().optional(),
        /** LLM filter passes per run; a doc is kept only if a majority of passes call it relevant. Odd, default 1. */
        filterVotes: z.number().int().positive().refine((n) => n % 2 === 1, "filterVotes must be odd").optional(),
        /** For Jev's top-N docs, Jev re-ranks full-text passages and the LLM filter also sees the best `perDoc`. */
        filterExcerpts: z.object({ topN: z.number().int().positive(), chunkChars: z.number().int().positive(), perDoc: z.number().int().positive(), maxChunks: z.number().int().positive() }).optional(),
        estUsd: z.number().positive(),
      }),
    )
    .min(1),
});

const JudgesSchema = z.object({
  minAgree: z.number().int().positive(),
  judges: z.array(z.object({ model: z.string() })).min(1),
  criteria: z.array(z.object({ id: z.string(), question: z.string(), needsRubric: z.boolean().optional() })).min(1),
});

const ExperimentSchema = z.object({
  budgetUsd: z.number().positive(),
  smokeSpendUsd: z.number().min(0),
  jevModel: z.string(),
  arena: z.object({ concurrency: z.number().int().positive(), defaultEvalset: z.string(), repeatOptions: z.array(z.number().int().positive()) }),
  userView: z.object({ setup: z.string(), maxWindowDays: z.number().int().positive() }),
  evals: z.object({
    gates: z.object({ recall: z.number(), precision: z.number() }),
    scoreWeights: z.record(z.enum(["recall", "precision", "trapAvoidance", "datesRight", "tierRight", "ownerRight", "judgePass", "consistency", "traceChecks"]), z.number().min(0)),
  }),
});

const PipelineSchema = z.object({
  tiering: z.object({
    criticalWindowDays: z.number().int().positive(),
    recentlyEffectiveDays: z.number().int().min(0),
    criticalDocTypes: z.array(z.enum(["Rule", "Proposed Rule", "Notice", "Presidential Document"])).min(1),
  }),
  filter: z.object({ jevConcurrency: z.number().int().positive(), llmBatchSize: z.number().int().positive(), llmConcurrency: z.number().int().positive(), abstractChars: z.number().int().positive() }),
  verify: z.object({ concurrency: z.number().int().positive(), snippetChars: z.number().int().positive() }),
  webLeads: z.object({ maxSteps: z.number().int().positive(), numResults: z.number().int().positive(), highlightChars: z.number().int().positive() }),
  baseline: z.object({ searchMaxSteps: z.number().int().positive(), anthropicMaxUses: z.number().int().positive(), exaNumResults: z.number().int().positive() }),
});

const PROMPT_NAMES = [
  "profileBrief", "jevQuestion", "jevState", "filterSystem", "filterPrompt", "extractSystem", "extractPrompt",
  "actionsSystem", "actionsPrompt", "webLeadsSystem", "webLeadsPrompt", "baselineTask", "baselineFormat",
  "panelJudge",
] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];
const PromptsSchema = z.object(Object.fromEntries(PROMPT_NAMES.map((n) => [n, z.string().min(1)])) as Record<PromptName, z.ZodString>);

const ManifestSchema = z.object({
  weeks: z.array(z.object({ id: z.string(), windowStart: ISO, windowEnd: ISO, asOf: ISO, split: z.enum(["dev", "test"]), note: z.string().optional() })),
  evalsets: z.array(z.object({ id: z.string(), company: z.string(), week: z.string() })),
});

export type Company = z.infer<typeof CompanySchema>;
export type Setups = z.infer<typeof SetupsSchema>;
export type Judges = z.infer<typeof JudgesSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type PipelineCfg = z.infer<typeof PipelineSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

// ── file reading with mtime-based cache (edits show up immediately, unchanged files aren't re-parsed) ──
const cache = new Map<string, { mtimeMs: number; value: unknown }>();
function readCached<T>(rel: string, read: () => T): T {
  const p = configPath(rel);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(p).mtimeMs;
  } catch {
    return read(); // missing file: let the reader throw its "Config error in config/<rel>" message
  }
  const hit = cache.get(p);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value as T;
  const value = read();
  cache.set(p, { mtimeMs, value });
  return value;
}
const yamlFile = <S extends z.ZodType>(rel: string, schema: S): z.infer<S> => readCached(rel, () => readYaml(rel, schema));
const jsonFile = <T>(rel: string): T =>
  readCached(rel, () => {
    try {
      return JSON.parse(fs.readFileSync(configPath(rel), "utf8")) as T;
    } catch (e) {
      throw new Error(`Config error in config/${rel}: ${(e as Error).message}`);
    }
  });

export const experiment = () => yamlFile("experiment.yaml", ExperimentSchema);
export const setups = () => yamlFile("setups.yaml", SetupsSchema);
export const judges = () => yamlFile("judges.yaml", JudgesSchema);
export const pipelineCfg = () => yamlFile("pipeline.yaml", PipelineSchema);
const basePrompts = () => yamlFile("prompts.yaml", PromptsSchema);
const PromptOverridesSchema = z.object(Object.fromEntries(PROMPT_NAMES.map((n) => [n, z.string().min(1).optional()])) as Record<PromptName, z.ZodOptional<z.ZodString>>).strict();

// The prompt set in effect for the current run. AsyncLocalStorage keeps parallel runs with different sets apart.
const promptScope = new AsyncLocalStorage<{ promptSet?: string }>();
export const withPromptSet = <T>(promptSet: string | undefined, fn: () => Promise<T>) => promptScope.run({ promptSet }, fn);
export const currentPromptSet = () => promptScope.getStore()?.promptSet;

export function promptSetNames(): string[] {
  const dir = configPath("prompt-sets");
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".yaml")).map((f) => f.replace(/\.yaml$/, "")).sort() : [];
}
export const promptSet = (name: string) => yamlFile(`prompt-sets/${name}.yaml`, PromptOverridesSchema);

/** Prompts for the current run: config/prompts.yaml, with the run's prompt-set overrides applied. */
export function prompts(): z.infer<typeof PromptsSchema> {
  const base = basePrompts();
  const set = currentPromptSet();
  if (!set) return base;
  const o = promptSet(set);
  return { ...base, ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) } as z.infer<typeof PromptsSchema>;
}
export const manifest = () => yamlFile("evalsets/manifest.yaml", ManifestSchema);

export function companies(): CompanyProfile[] {
  const files = fs.readdirSync(configPath("companies")).filter((f) => f.endsWith(".yaml")).sort();
  return files.map((f) => {
    const c = yamlFile(`companies/${f}`, CompanySchema);
    if (`${c.id}.yaml` !== f) throw new Error(`config/companies/${f}: id "${c.id}" must match the file name`);
    return c;
  });
}

export function getCompany(id: string): CompanyProfile {
  const c = companies().find((x) => x.id === id);
  if (!c) throw new Error(`Unknown company "${id}" (config/companies/)`);
  return c;
}

/** A profile the GC can pick on the new-run screen. Only `use: demo`; eval companies were tuned on, so never offered. */
export const isPreset = (c: Pick<CompanyProfile, "use">) => c.use === "demo";
export const presets = (): CompanyProfile[] => companies().filter(isPreset);

// ── prompts ──
/** Fills {{name}} placeholders. Missing or unused variables are errors, so a template and its caller can't drift. */
export function render(template: string, vars: Record<string, string | number>): string {
  const used = new Set<string>();
  const out = template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    if (!(k in vars)) throw new Error(`prompt placeholder {{${k}}} has no value`);
    used.add(k);
    return String(vars[k]);
  });
  const unused = Object.keys(vars).filter((k) => !used.has(k));
  if (unused.length) throw new Error(`prompt variables not used by the template: ${unused.join(", ")}`);
  return out;
}
export const prompt = (name: PromptName, vars: Record<string, string | number> = {}) => render(prompts()[name], vars);

// ── eval sets ──
const weekFile = (start: string, end: string) => `evalsets/weeks/${start}_${end}.json`;
const keyFile = (company: string, start: string, end: string) => `evalsets/keys/${company}_${start}_${end}.json`;

/** Frozen week input, or null if this window isn't an eval-set week. */
export function frozenWeek(start: string, end: string): FrDoc[] | null {
  if (!fs.existsSync(configPath(weekFile(start, end)))) return null;
  return jsonFile<FrDoc[]>(weekFile(start, end));
}

export function loadKey(company: string, start: string, end: string): LabelSet | null {
  if (!fs.existsSync(configPath(keyFile(company, start, end)))) return null;
  return jsonFile<LabelSet>(keyFile(company, start, end));
}


export function evalsets() {
  const m = manifest();
  return m.evalsets.map((e) => {
    const week = m.weeks.find((w) => w.id === e.week);
    if (!week) throw new Error(`config/evalsets/manifest.yaml: eval set ${e.id} names unknown week ${e.week}`);
    return { ...e, ...week, id: e.id, weekId: week.id };
  });
}

/** The eval set pages and CLIs fall back to (experiment.yaml → arena.defaultEvalset). */
export function defaultEvalset() {
  const id = experiment().arena.defaultEvalset;
  const e = evalsets().find((x) => x.id === id);
  if (!e) throw new Error(`experiment.arena.defaultEvalset "${id}" is not in config/evalsets/manifest.yaml`);
  return e;
}

/** Cross-file checks the per-file schemas can't do. Returns a list of problems (empty = valid). */
export function validateAll(): string[] {
  const problems: string[] = [];
  const cos = companies();
  const st = setups();
  const jg = judges();
  if (jg.minAgree > jg.judges.length) problems.push(`judges.minAgree (${jg.minAgree}) is more than the number of judges`);
  const sets = promptSetNames();
  for (const s of sets) promptSet(s); // schema-checks every prompt set (unknown prompt names are errors)
  for (const x of st.setups) {
    if (x.promptSet && !sets.includes(x.promptSet)) problems.push(`setup ${x.id}: prompt set "${x.promptSet}" has no config/prompt-sets/${x.promptSet}.yaml`);
    if (!st.models.some((m) => m.id === x.model)) problems.push(`setup ${x.id}: model ${x.model} is not listed under setups.yaml → models`);
    if (!st.methods.some((m) => m.id === x.method)) problems.push(`setup ${x.id}: unknown method ${x.method}`);
  }
  if (new Set(st.setups.map((x) => x.id)).size !== st.setups.length) problems.push("setups.yaml: duplicate setup id");
  experiment();
  pipelineCfg();
  prompts();
  const m = manifest();
  for (const c of cos) {
    if (!Object.keys(c.areas).length) problems.push(`company ${c.id} has no areas`);
  }
  if (!evalsets().some((e) => e.id === experiment().arena.defaultEvalset)) problems.push(`experiment.arena.defaultEvalset "${experiment().arena.defaultEvalset}" is not in the manifest`);
  for (const e of m.evalsets) {
    if (!cos.some((c) => c.id === e.company)) problems.push(`eval set ${e.id}: unknown company ${e.company}`);
    const w = m.weeks.find((x) => x.id === e.week);
    if (!w) {
      problems.push(`eval set ${e.id}: unknown week ${e.week}`);
      continue;
    }
    const input = frozenWeek(w.windowStart, w.windowEnd);
    if (!input) problems.push(`week ${w.id}: missing ${weekFile(w.windowStart, w.windowEnd)}`);
    const key = loadKey(e.company, w.windowStart, w.windowEnd);
    if (key && input) {
      const nums = new Set(input.map((d) => d.document_number));
      const stray = key.relevant.filter((n) => !nums.has(n));
      if (stray.length) problems.push(`key ${e.id}: doc numbers not in the week input: ${stray.join(", ")}`);
      const noDetail = key.details ? key.relevant.filter((n) => !key.details![n]) : [];
      if (noDetail.length) problems.push(`key ${e.id}: relevant docs without details: ${noDetail.join(", ")}`);
    }
  }
  return problems;
}

/**
 * Short hash of every config file except the (large, frozen) week inputs — stamped on each run.
 * `dir` defaults to the app's config/; pass another directory to hash a copy (tests, POC comparison).
 */
export function configHash(dir: string = configPath()): string {
  const h = crypto.createHash("sha256");
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(/*turbopackIgnore: true*/ d, f.name);
      if (f.isDirectory()) {
        if (p !== path.join(/*turbopackIgnore: true*/ dir, "evalsets")) walk(p);
      } else if (/\.(ya?ml)$/.test(f.name)) {
        h.update(path.relative(dir, p));
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(dir);
  return h.digest("hex").slice(0, 10);
}
