import { EvalIndexSchema, type EvalIndex } from "./index-schema";

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
