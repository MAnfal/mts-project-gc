// Test support: replays one recorded run of the live setup through the ported pipeline.
//
// replay-06.jsonl.gz is the POC's execution trace of run 2026-11-21T23-16-59-591Z_pipeline_zxuc
// (suite arena-2026-11-21-23-16-du8, setup jev-sonnet-strict-passages, Brightside, frozen week 2026-11-02..06).
// replay-06-sources.json.gz holds the Federal Register and govinfo responses that run read, captured once from
// the free public APIs (url -> {status, body}); replay-06-markdown.md is that run's markdown report.
//
// Every model answer comes from the trace. Decision calls are matched by their exact input state, extraction and
// action calls by their exact system + prompt, and filter calls by document number. A request the trace never
// made is answered with "nothing" and listed in `unrecorded`, so a drifted port fails on values, not on timeouts.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { RunConfig } from "../../types";
import { runPipeline, type PipelineResult } from "../run";
import type { RunEvent } from "../events";
import { docsInPrompt, installModels, restoreModels, type JevCall, type LlmCall } from "./harness";

const DIR = path.join(process.cwd(), "src/lib/pipeline/__fixtures__");

export type TraceEvent = { type: string; [k: string]: unknown };

const gunzip = (file: string) => zlib.gunzipSync(fs.readFileSync(path.join(DIR, file))).toString("utf8");

export const recordedTrace = (): TraceEvent[] =>
  gunzip("replay-06.jsonl.gz")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as TraceEvent);

export const recordedMarkdown = () => fs.readFileSync(path.join(DIR, "replay-06-markdown.md"), "utf8");

const recordedSources = () => JSON.parse(gunzip("replay-06-sources.json.gz")) as Record<string, { status: number; body: string }>;

export interface ReplayResult {
  events: RunEvent[];
  /** The ported pipeline's internal trace (same event names and fields as the POC's). */
  trace: TraceEvent[];
  result: PipelineResult;
  calls: { llm: LlmCall[]; jev: JevCall[] };
  /** Requests the recorded run never made: URLs, decision states, prompts. Empty on a faithful port. */
  unrecorded: string[];
  recorded: TraceEvent[];
}

export async function runReplay(): Promise<ReplayResult> {
  const recorded = recordedTrace();
  const start = recorded.find((e) => e.type === "run.start")!;
  const config = start.config as RunConfig;
  const sources = recordedSources();
  const unrecorded: string[] = [];

  const jevByState = new Map<string, number>();
  for (const e of recorded.filter((x) => x.type === "jev.call")) {
    const prev = jevByState.get(e.state as string);
    if (prev !== undefined && prev !== e.probability) throw new Error(`fixture: one state, two probabilities (${e.document_number})`);
    jevByState.set(e.state as string, e.probability as number);
  }
  const llmCalls = recorded.filter((e) => e.type === "llm.call");
  const filterByDoc = new Map<string, unknown>();
  for (const e of llmCalls.filter((x) => String(x.stage).startsWith("filter-llm")))
    for (const d of (e.output as { decisions: { document_number: string }[] }).decisions) filterByDoc.set(d.document_number, d);
  const exact = new Map(llmCalls.map((e) => [`${e.system}\n\u0000\n${e.prompt}`, e.output]));
  const EMPTY = { extract: { deadlines: [] }, actions: { actions: [] } };

  const calls = installModels({
    jev: ({ state }) => {
      const p = jevByState.get(state);
      if (p === undefined) {
        unrecorded.push(`jev state: ${state.slice(0, 200)}`);
        return 0;
      }
      return p;
    },
    llm: ({ kind, system, prompt }) => {
      if (kind === "filter") return { decisions: docsInPrompt(prompt).filter((n) => filterByDoc.has(n)).map((n) => filterByDoc.get(n)) };
      const out = exact.get(`${system}\n\u0000\n${prompt}`);
      if (out === undefined) {
        unrecorded.push(`${kind} prompt: ${prompt.slice(0, 200)}`);
        return EMPTY[kind];
      }
      return out;
    },
  });

  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const hit = sources[String(input)];
    if (!hit) {
      unrecorded.push(`url: ${String(input)}`);
      return new Response("not recorded", { status: 404 });
    }
    return new Response(hit.body, { status: hit.status });
  }) as typeof fetch;

  const events: RunEvent[] = [];
  const trace: TraceEvent[] = [];
  try {
    const result = await runPipeline(config, (e) => events.push(e), { trace: (type, data) => trace.push({ type, ...data }) });
    return { events, trace, result, calls, unrecorded, recorded };
  } finally {
    globalThis.fetch = realFetch;
    restoreModels();
  }
}

/** `e` without the given fields. */
export const omit = (e: TraceEvent, keys: string[]) => Object.fromEntries(Object.entries(e).filter(([k]) => !keys.includes(k)));

/** Drop the POC trace's envelope fields, which differ on every run. */
export const body = (e: TraceEvent) => omit(e, ["seq", "ts", "runId"]);
