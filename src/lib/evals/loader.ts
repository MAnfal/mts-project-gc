import { z } from "zod";
import { EvalIndexSchema, UserViewIndexSchema, type EvalIndex, type UserViewIndex } from "./index-schema";

/**
 * Browser-side reader for the static eval bundle in public/evals (layout: plans/2026-11-22-demo-build,
 * chunk 07). The .gz files are served as plain `application/gzip` bytes, not with Content-Encoding, so the
 * client decompresses them itself with DecompressionStream and parses JSON lines as they stream in.
 */

export interface LoaderOptions {
  /** URL prefix the bundle is served under. Default `/evals`. */
  baseUrl?: string;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

/** Pseudo suite id for the example runs, whose files live under user-view/ rather than suites/<id>/. */
export const USER_VIEW = "user-view";

/** A run record (POC SCHEMA.md `RunRecord`). Only `id` is relied on here; pages narrow the rest. */
export type EvalRun = { id: string; superseded?: boolean } & Record<string, unknown>;
/** One trace line (POC SCHEMA.md trace events). */
export type TraceEvent = { seq: number; type: string } & Record<string, unknown>;

async function get(url: string, opts: LoaderOptions): Promise<Response> {
  const res = await (opts.fetch ?? fetch)(url);
  if (!res.ok) throw new Error(`Eval bundle: GET ${url} returned ${res.status}`);
  return res;
}

const base = (opts: LoaderOptions) => opts.baseUrl ?? "/evals";

/** Gunzips a response body and yields one parsed JSON value per non-empty line, as the bytes arrive. */
async function* gzipJsonLines<T>(res: Response, url: string): AsyncGenerator<T> {
  if (!res.body) return;
  let bytesIn = 0;
  const counted = res.body.pipeThrough(
    new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
      transform(chunk, ctl) {
        bytesIn += chunk.byteLength;
        ctl.enqueue(chunk);
      },
    }),
  );
  const reader = counted.pipeThrough(new DecompressionStream("gzip")).getReader();
  const text = new TextDecoder();
  let buf = "";
  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (e) {
      // A 0-byte file is an empty trace; DecompressionStream rejects it as truncated gzip.
      if (bytesIn === 0) return;
      throw new Error(`Eval bundle: ${url} is not valid gzip (${(e as Error).message || "decompression failed"})`);
    }
    if (chunk.done) break;
    buf += text.decode(chunk.value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.trim()) yield JSON.parse(line) as T;
    }
  }
  buf += text.decode();
  if (buf.trim()) yield JSON.parse(buf) as T;
}

/** index.json, validated: every result number is labelled with split, run count and suite. */
export async function loadIndex(opts: LoaderOptions = {}): Promise<EvalIndex> {
  const res = await get(`${base(opts)}/index.json`, opts);
  return EvalIndexSchema.parse(await res.json());
}

/** Every run record of one suite (runs.jsonl.gz, superseded runs included and flagged). */
export async function loadSuiteRuns(suiteId: string, opts: LoaderOptions = {}): Promise<EvalRun[]> {
  const url = `${base(opts)}/suites/${encodeURIComponent(suiteId)}/runs.jsonl.gz`;
  const runs: EvalRun[] = [];
  for await (const r of gzipJsonLines<EvalRun>(await get(url, opts), url)) runs.push(r);
  return runs;
}

/** One run's trace events, lazily: each event is parsed only when the consumer pulls it. */
export async function* loadTrace(suiteId: string, runId: string, opts: LoaderOptions = {}): AsyncGenerator<TraceEvent> {
  const dir = suiteId === USER_VIEW ? `${base(opts)}/user-view` : `${base(opts)}/suites/${encodeURIComponent(suiteId)}`;
  const url = `${dir}/traces/${encodeURIComponent(runId)}.jsonl.gz`;
  yield* gzipJsonLines<TraceEvent>(await get(url, opts), url);
}

/**
 * iterations/<id>/iteration.json: the POC's spec.yaml merged with iteration.yaml (chunk 07). Only the recorded
 * text the eval view shows is typed; every other recorded field passes through untouched. `07-next` is
 * evidence-only and has none of them.
 */
export const IterationRecordSchema = z.looseObject({
  id: z.string(),
  evidenceOnly: z.boolean(),
  title: z.string().optional(),
  hypothesis: z.string().optional(),
  change: z.string().optional(),
  decision: z.string().optional(),
  notes: z.string().optional(),
});
export type IterationRecord = z.infer<typeof IterationRecordSchema>;

export async function loadIteration(id: string, opts: LoaderOptions = {}): Promise<IterationRecord> {
  const res = await get(`${base(opts)}/iterations/${encodeURIComponent(id)}/iteration.json`, opts);
  return IterationRecordSchema.parse(await res.json());
}

/** Evidence files an iteration may ship (index.iterations[].evidence says which exist). */
export type IterationFile = "system.diff" | "config.diff" | "error-analysis.json";

/** One evidence file's text, as shipped. */
export async function loadIterationFile(id: string, name: IterationFile, opts: LoaderOptions = {}): Promise<string> {
  const res = await get(`${base(opts)}/iterations/${encodeURIComponent(id)}/${name}`, opts);
  return res.text();
}

// ── Chunk 09: what the Cases, Runs and trace pages read ──

const CountsSchema = z.object({ tp: z.number(), fn: z.number(), trapHit: z.number(), tn: z.number(), unlabeled: z.number() });

/** suites/<id>/report.json: the POC's suiteReport for that suite. Only the per-setup counts and metrics are typed. */
export const SuiteReportSchema = z.looseObject({
  setups: z.array(
    z.looseObject({
      key: z.string(),
      label: z.string().optional(),
      counts: CountsSchema,
      metrics: z.record(z.string(), z.number().nullable()),
    }),
  ),
});
export type SuiteReport = z.infer<typeof SuiteReportSchema>;

export async function loadSuiteReport(suiteId: string, opts: LoaderOptions = {}): Promise<SuiteReport> {
  const res = await get(`${base(opts)}/suites/${encodeURIComponent(suiteId)}/report.json`, opts);
  return SuiteReportSchema.parse(await res.json());
}

/** One deterministic check of a run's trace (POC src/lib/trace-checks.ts). */
export const TraceCheckSchema = z.object({ id: z.string(), label: z.string(), pass: z.boolean(), detail: z.string() });
export type TraceCheck = z.infer<typeof TraceCheckSchema>;
const TraceChecksSchema = z.record(z.string(), z.array(TraceCheckSchema));

/**
 * suites/<id>/trace-checks.json: every run's checks, keyed by run id. Null for the example runs (USER_VIEW),
 * which record none; nothing is fetched for them.
 */
export async function loadTraceChecks(suiteId: string, opts: LoaderOptions = {}): Promise<Record<string, TraceCheck[]> | null> {
  if (suiteId === USER_VIEW) return null;
  const res = await get(`${base(opts)}/suites/${encodeURIComponent(suiteId)}/trace-checks.json`, opts);
  return TraceChecksSchema.parse(await res.json());
}

/**
 * config/evalsets/keys/<evalset>.json: which docs should be flagged (`relevant`, with `details`) and which are
 * look-alikes to skip (`traps`: a list in v1 keys, a map to the reason in v2). Untyped fields pass through.
 */
export const AnswerKeySchema = z.looseObject({
  relevant: z.array(z.string()),
  details: z.record(z.string(), z.looseObject({ kind: z.enum(["direct", "indirect"]).optional(), reason: z.string().optional() })).optional(),
  traps: z.union([z.array(z.string()), z.record(z.string(), z.looseObject({ reason: z.string().optional() }))]),
});
export type AnswerKeyFile = z.infer<typeof AnswerKeySchema>;

export async function loadAnswerKey(evalsetId: string, opts: LoaderOptions = {}): Promise<AnswerKeyFile> {
  const res = await get(`${base(opts)}/config/evalsets/keys/${encodeURIComponent(evalsetId)}.json`, opts);
  return AnswerKeySchema.parse(await res.json());
}

/** config/evalsets/weeks/<week>.json, the frozen Federal Register input, reduced to what names a rule. */
const WeekDocsSchema = z.array(z.looseObject({ document_number: z.string(), title: z.string(), type: z.string() }));
export type WeekDoc = { document_number: string; title: string; type: string };

export async function loadWeekDocs(weekId: string, opts: LoaderOptions = {}): Promise<WeekDoc[]> {
  const res = await get(`${base(opts)}/config/evalsets/weeks/${encodeURIComponent(weekId)}.json`, opts);
  return WeekDocsSchema.parse(await res.json()).map(({ document_number, title, type }) => ({ document_number, title, type }));
}

/** user-view/index.json: every example run (failed ones too), for the Runs page. */
export async function loadUserViewIndex(opts: LoaderOptions = {}): Promise<UserViewIndex> {
  const res = await get(`${base(opts)}/user-view/index.json`, opts);
  return UserViewIndexSchema.parse(await res.json());
}
