import { generateText, Output, experimental_decide as decide, isStepCount, type ToolSet } from "ai";
import type { z } from "zod";
import { experiment } from "../config";
import { decisionModel, gatewayCost, languageModel } from "../gateway";
import { budgetUsd, saveRun, spentUsd } from "../store";
import { Tracer } from "../trace";
import type { LlmCallLog, RunRecord } from "../types";

export class BudgetExceeded extends Error {}

type Step = { toolCalls: { toolName: string; toolCallId: string; input: unknown }[]; toolResults: { toolCallId: string; output: unknown }[]; providerMetadata?: unknown; finishReason?: unknown };
const toolCallsOf = (steps: Step[]) =>
  steps.flatMap((s) => s.toolCalls.map((c) => ({ name: c.toolName, input: c.input, output: s.toolResults.find((x) => x.toolCallId === c.toolCallId)?.output })));
const costOf = (steps: Step[], fallback?: unknown) => steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0) || gatewayCost(fallback);

/**
 * Per-run bookkeeping: every model call goes through here, so cost, latency and I/O land in both the run record
 * (data/runs/<id>.json, summary) and the execution trace (data/traces/<id>.jsonl, every step in full).
 */
export class RunCtx {
  private spentAtStart = 0;
  readonly trace: Tracer;
  constructor(public run: RunRecord) {
    this.trace = new Tracer(run);
  }

  async init() {
    // Excludes this run (not yet saved), so the guard below compares prior spend + this run's spend.
    this.spentAtStart = await spentUsd();
    if (this.spentAtStart >= budgetUsd()) throw new BudgetExceeded(`Budget exhausted: $${this.spentAtStart.toFixed(2)} of $${budgetUsd()}`);
  }

  private guard() {
    if (this.spentAtStart + this.run.totalCostUsd >= budgetUsd()) {
      throw new BudgetExceeded(`Budget cap $${budgetUsd()} reached mid-run`);
    }
  }

  private record(log: LlmCallLog) {
    this.run.calls.push(log);
    this.run.totalCostUsd += log.costUsd;
  }

  async stage<T>(name: string, fn: () => Promise<T>, counts?: (r: T) => { inCount?: number; outCount?: number; note?: string }) {
    const t0 = Date.now();
    const costBefore = this.run.totalCostUsd;
    this.trace.emit("stage.start", { stage: name });
    const r = await fn();
    const log = { name, ms: Date.now() - t0, costUsd: this.run.totalCostUsd - costBefore, ...(counts?.(r) ?? {}) };
    this.run.stages.push(log);
    this.trace.emit("stage.end", { stage: name, ms: log.ms, costUsd: log.costUsd, inCount: log.inCount, outCount: log.outCount, note: log.note, runCostSoFar: this.run.totalCostUsd });
    await saveRun(this.run);
    return r;
  }

  /** Structured LLM call (optionally with tools). `logPrompt: false` keeps a long prompt out of the run summary only; the trace always has it. */
  async object<S extends z.ZodType>(stage: string, args: { model: string; system?: string; prompt: string; schema: S; tools?: ToolSet; logPrompt?: boolean }): Promise<z.infer<S>> {
    this.guard();
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: languageModel(args.model),
        system: args.system,
        prompt: args.prompt,
        tools: args.tools,
        output: Output.object({ schema: args.schema }),
        maxRetries: 2,
      });
      const steps = r.steps as unknown as Step[];
      const toolCalls = toolCallsOf(steps);
      const costUsd = costOf(steps, r.providerMetadata);
      this.record({
        stage,
        model: args.model,
        ms: Date.now() - t0,
        costUsd,
        inputTokens: r.totalUsage.inputTokens,
        outputTokens: r.totalUsage.outputTokens,
        prompt: args.logPrompt === false ? undefined : args.prompt,
        output: r.output,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      });
      this.trace.emit("llm.call", {
        stage,
        model: args.model,
        system: args.system ?? "",
        prompt: args.prompt,
        tools: args.tools ? Object.keys(args.tools) : [],
        output: r.output,
        toolCalls,
        steps: steps.length,
        usage: r.totalUsage,
        costUsd,
        ms: Date.now() - t0,
      });
      return r.output as z.infer<S>;
    } catch (e) {
      this.record({ stage, model: args.model, ms: Date.now() - t0, costUsd: 0, prompt: args.prompt, error: (e as Error).message });
      this.trace.emit("llm.call", { stage, model: args.model, system: args.system ?? "", prompt: args.prompt, error: (e as Error).message, costUsd: 0, ms: Date.now() - t0 });
      throw e;
    }
  }

  /** Free-form tool loop (web leads, baseline research). Returns text + every tool call. */
  async agent(stage: string, args: { model: string; system?: string; prompt: string; tools: ToolSet; maxSteps: number }) {
    this.guard();
    const t0 = Date.now();
    const r = await generateText({ model: languageModel(args.model), system: args.system, prompt: args.prompt, tools: args.tools, stopWhen: isStepCount(args.maxSteps) });
    const steps = r.steps as unknown as Step[];
    const toolCalls = toolCallsOf(steps);
    const costUsd = costOf(steps);
    this.record({ stage, model: args.model, ms: Date.now() - t0, costUsd, inputTokens: r.totalUsage.inputTokens, outputTokens: r.totalUsage.outputTokens, prompt: args.prompt, output: r.text, toolCalls });
    this.trace.emit("llm.call", {
      stage,
      model: args.model,
      system: args.system ?? "",
      prompt: args.prompt,
      tools: Object.keys(args.tools),
      output: r.text,
      toolCalls,
      sources: r.sources,
      steps: steps.length,
      usage: r.totalUsage,
      costUsd,
      ms: Date.now() - t0,
    });
    return { text: r.text, toolCalls, sources: r.sources };
  }

  /** Jev (decision model): returns a probability only. Every call is traced with what it was asked. */
  async jev(state: string, question: string, documentNumber: string): Promise<{ p: number; cost: number; ms: number }> {
    this.guard();
    const t0 = Date.now();
    const model = experiment().jevModel;
    const r = await decide({
      model: decisionModel(model),
      state,
      questions: { relevant: { type: "boolean", instructions: question } },
      maxRetries: 3,
    });
    const cost = gatewayCost((r as unknown as { providerMetadata?: unknown }).providerMetadata);
    this.run.totalCostUsd += cost;
    const a = r.answers.relevant as { probability?: number };
    const p = a.probability ?? 0;
    this.trace.emit("jev.call", { stage: "filter:jev", model, document_number: documentNumber, question, state, probability: p, costUsd: cost, ms: Date.now() - t0 });
    return { p, cost, ms: Date.now() - t0 };
  }
}
