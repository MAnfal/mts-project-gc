import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { z } from "zod";
import type { CompanyProfile, FrDoc, LabelSet } from "./types";

/**
 * Everything tunable lives in poc/config/ (YAML for what people edit, JSON for data). This module only
 * reads and validates it; the rest of the code executes it. Files are re-read when they change on disk
 * (mtime check), so editing a YAML takes effect without a restart.
 */
export const CONFIG_DIR = process.env.POC_CONFIG_DIR ?? path.resolve(process.cwd(), "config");

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be a quoted YYYY-MM-DD string");
const owner = z.object({ name: z.string(), email: z.string() });

export const CompanySchema = z.object({
  id: z.string(),
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
});

const ExperimentSchema = z.object({
  budgetUsd: z.number().positive(),
  smokeSpendUsd: z.number().min(0),
  jevModel: z.string(),
  judgeModel: z.string(),
  arena: z.object({ concurrency: z.number().int().positive(), defaultEvalset: z.string(), repeatOptions: z.array(z.number().int().positive()) }),
  evals: z.object({ gates: z.object({ recall: z.number(), precision: z.number() }) }),
});

const PipelineSchema = z.object({
  tiering: z.object({ criticalWindowDays: z.number().int().positive(), recentlyEffectiveDays: z.number().int().min(0) }),
  filter: z.object({ jevConcurrency: z.number().int().positive(), llmBatchSize: z.number().int().positive(), llmConcurrency: z.number().int().positive(), abstractChars: z.number().int().positive() }),
  verify: z.object({ concurrency: z.number().int().positive(), snippetChars: z.number().int().positive() }),
  webLeads: z.object({ maxSteps: z.number().int().positive(), numResults: z.number().int().positive(), highlightChars: z.number().int().positive() }),
  baseline: z.object({ searchMaxSteps: z.number().int().positive(), anthropicMaxUses: z.number().int().positive(), exaNumResults: z.number().int().positive() }),
});

const PROMPT_NAMES = [
  "profileBrief", "jevQuestion", "jevState", "filterSystem", "filterPrompt", "extractSystem", "extractPrompt",
  "actionsSystem", "actionsPrompt", "webLeadsSystem", "webLeadsPrompt", "baselineTask", "baselineFormat", "judgeClarity",
] as const;
export type PromptName = (typeof PROMPT_NAMES)[number];
const PromptsSchema = z.object(Object.fromEntries(PROMPT_NAMES.map((n) => [n, z.string().min(1)])) as Record<PromptName, z.ZodString>);

const ManifestSchema = z.object({
  weeks: z.array(z.object({ id: z.string(), windowStart: ISO, windowEnd: ISO, asOf: ISO, note: z.string().optional() })),
  evalsets: z.array(z.object({ id: z.string(), company: z.string(), week: z.string() })),
});

export type Company = z.infer<typeof CompanySchema>;
export type Setups = z.infer<typeof SetupsSchema>;
export type Experiment = z.infer<typeof ExperimentSchema>;
export type PipelineCfg = z.infer<typeof PipelineSchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

// ── file reading with mtime-based cache (edits show up immediately, unchanged files aren't re-parsed) ──
const cache = new Map<string, { mtimeMs: number; value: unknown }>();
function readFile<T>(rel: string, parse: (text: string) => T): T {
  const p = path.join(CONFIG_DIR, rel);
  const { mtimeMs } = fs.statSync(p);
  const hit = cache.get(p);
  if (hit && hit.mtimeMs === mtimeMs) return hit.value as T;
  let value: T;
  try {
    value = parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    throw new Error(`config/${rel}: ${(e as Error).message}`);
  }
  cache.set(p, { mtimeMs, value });
  return value;
}
const yamlFile = <S extends z.ZodType>(rel: string, schema: S): z.infer<S> => readFile(rel, (t) => schema.parse(YAML.parse(t)));

export const experiment = () => yamlFile("experiment.yaml", ExperimentSchema);
export const setups = () => yamlFile("setups.yaml", SetupsSchema);
export const pipelineCfg = () => yamlFile("pipeline.yaml", PipelineSchema);
export const prompts = () => yamlFile("prompts.yaml", PromptsSchema);
export const manifest = () => yamlFile("evalsets/manifest.yaml", ManifestSchema);

export function companies(): CompanyProfile[] {
  const files = fs.readdirSync(path.join(CONFIG_DIR, "companies")).filter((f) => f.endsWith(".yaml")).sort();
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
  if (!fs.existsSync(path.join(CONFIG_DIR, weekFile(start, end)))) return null;
  return readFile(weekFile(start, end), (t) => JSON.parse(t) as FrDoc[]);
}

export function loadKey(company: string, start: string, end: string): LabelSet | null {
  if (!fs.existsSync(path.join(CONFIG_DIR, keyFile(company, start, end)))) return null;
  return readFile(keyFile(company, start, end), (t) => JSON.parse(t) as LabelSet);
}

export function keyPath(company: string, start: string, end: string) {
  return path.join(CONFIG_DIR, keyFile(company, start, end));
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
  setups();
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

/** Short hash of every config file except the (large, frozen) week inputs — stamped on each run. */
export function configHash(): string {
  const h = crypto.createHash("sha256");
  const walk = (dir: string) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, f.name);
      if (f.isDirectory()) {
        if (p !== path.join(CONFIG_DIR, "evalsets")) walk(p);
      } else if (/\.(ya?ml)$/.test(f.name)) {
        h.update(path.relative(CONFIG_DIR, p));
        h.update(fs.readFileSync(p));
      }
    }
  };
  walk(CONFIG_DIR);
  return h.digest("hex").slice(0, 10);
}
