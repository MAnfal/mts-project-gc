import "server-only";
import { generateText, Output, experimental_decide as decide } from "ai";
import type { z } from "zod";
import { experiment } from "../config";
import { decisionModel, gatewayCost, languageModel } from "../gateway";
import type { RunConfig } from "../types";
import { assertPublic, stepOf, type RunEvent, type StepKey } from "./events";
import { withRetry, type OnRetry } from "./retry";

// Ported from poc:poc/src/lib/pipeline/context.ts. Changes, none of which touches a decision:
// - The run is not saved: no RunRecord on disk, no JSONL trace file, no spend ledger or budget guard.
// - Internal trace events go to `trace` (a no-op unless DEBUG_PIPELINE is set, or a test passes a sink);
//   what the GC sees goes through `emit` as public RunEvents, each checked by assertPublic.
// - Every model call is retried by withRetry (3 tries, 2 s and 4 s apart) and reported as step.retry. The SDK's own
//   retries are off (maxRetries: 0; the POC used 2 and 3), so a call is never tried more than 3 times in total.

type Step = { toolCalls: { toolName: string; toolCallId: string; input: unknown }[]; toolResults: { toolCallId: string; output: unknown }[]; providerMetadata?: unknown };
const costOf = (steps: Step[], fallback?: unknown) => steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0) || gatewayCost(fallback);

export type TraceSink = (type: string, data: Record<string, unknown>) => void;

const debugTrace: TraceSink = (type, data) => {
  if (process.env.DEBUG_PIPELINE) console.debug(`[Pipeline] ${type}`, JSON.stringify(data));
};

/** The step a failure happened in, so the run can report it without guessing. */
export class StepFailed extends Error {
  constructor(
    readonly step: StepKey,
    readonly label: string,
    cause: unknown,
  ) {
    super(`step ${step} failed`, { cause });
    this.name = "StepFailed";
  }
}

/** Per-run bookkeeping: every model call goes through here, so retries, cost and the trace are handled once. */
export class RunCtx {
  totalCostUsd = 0;
  private current: { step: StepKey; label: string } | null = null;
  private ended = false;
  /** Set once the run has failed: calls still queued give up instead of starting. */
  failed = false;

  constructor(
    readonly run: { config: RunConfig },
    readonly company: string,
    private sink: (e: RunEvent) => void,
    readonly trace: { emit: TraceSink } = { emit: debugTrace },
  ) {}

  /** Send a public event to the browser. Nothing is sent after the run's terminal event. */
  emit(event: RunEvent) {
    if (this.ended) return;
    assertPublic(event);
    if (event.type === "run.done" || event.type === "run.failed") this.ended = true;
    this.sink(event);
  }

  /** step.retry for whichever step is running; the Federal Register client reports through this too. */
  readonly onRetry: OnRetry = ({ attempt, delayMs }) => {
    if (this.current) this.emit({ type: "step.retry", step: this.current.step, attempt, delayMs });
  };

  readonly stopped = () => this.failed;

  get step() {
    return this.current;
  }

  private async retry<T>(fn: () => Promise<T>) {
    if (this.failed) throw new Error("run already failed");
    return withRetry(fn, undefined, this.onRetry, this.stopped);
  }

  async stage<T>(name: string, fn: () => Promise<T>, counts?: (r: T) => { inCount?: number; outCount?: number; note?: string }) {
    const t0 = Date.now();
    const costBefore = this.totalCostUsd;
    const step = stepOf(name, this.company);
    this.current = step;
    this.trace.emit("stage.start", { stage: name });
    this.emit({ type: "step.start", ...step });
    let r: T;
    try {
      r = await fn();
    } catch (e) {
      throw e instanceof StepFailed ? e : new StepFailed(step.step, step.label, e);
    }
    const log = { name, ms: Date.now() - t0, costUsd: this.totalCostUsd - costBefore, ...(counts?.(r) ?? {}) };
    this.trace.emit("stage.end", { stage: name, ms: log.ms, costUsd: log.costUsd, inCount: log.inCount, outCount: log.outCount, note: log.note, runCostSoFar: this.totalCostUsd });
    this.emit({ type: "step.done", step: step.step, count: log.outCount ?? 0, ms: log.ms });
    this.current = null;
    return r;
  }

  /** Structured LLM call. `logPrompt` is kept for the POC's call sites; the trace always has the prompt. */
  async object<S extends z.ZodType>(stage: string, args: { model: string; system?: string; prompt: string; schema: S; logPrompt?: boolean }): Promise<z.infer<S>> {
    const t0 = Date.now();
    const model = languageModel(args.model);
    try {
      const r = await this.retry(() =>
        generateText({
          model,
          system: args.system,
          prompt: args.prompt,
          output: Output.object({ schema: args.schema }),
          maxRetries: 0,
        }),
      );
      const steps = r.steps as unknown as Step[];
      const costUsd = costOf(steps, r.providerMetadata);
      this.totalCostUsd += costUsd;
      this.trace.emit("llm.call", {
        stage,
        model: args.model,
        system: args.system ?? "",
        prompt: args.prompt,
        tools: [],
        output: r.output,
        steps: steps.length,
        usage: r.totalUsage,
        costUsd,
        ms: Date.now() - t0,
      });
      return r.output as z.infer<S>;
    } catch (e) {
      this.trace.emit("llm.call", { stage, model: args.model, system: args.system ?? "", prompt: args.prompt, error: (e as Error).message, costUsd: 0, ms: Date.now() - t0 });
      throw e;
    }
  }

  /** Decision model: returns a probability only. Every call is traced with what it was asked. */
  async jev(state: string, question: string, documentNumber: string): Promise<{ p: number; cost: number; ms: number }> {
    const t0 = Date.now();
    const model = experiment().jevModel;
    const dm = decisionModel(model);
    const r = await this.retry(() =>
      decide({
        model: dm,
        state,
        questions: { relevant: { type: "boolean", instructions: question } },
        maxRetries: 0,
      }),
    );
    const cost = gatewayCost((r as unknown as { providerMetadata?: unknown }).providerMetadata);
    this.totalCostUsd += cost;
    const a = r.answers.relevant as { probability?: number };
    const p = a.probability ?? 0;
    this.trace.emit("jev.call", { stage: "filter:jev", model, document_number: documentNumber, question, state, probability: p, costUsd: cost, ms: Date.now() - t0 });
    return { p, cost, ms: Date.now() - t0 };
  }
}
