import { generateText, Output, experimental_decide as decide, type ToolSet } from "ai";
import type { z } from "zod";
import { gw, gatewayCost } from "../gateway";
import { experiment } from "../config";
import { budgetUsd, saveRun, spentUsd } from "../store";
import type { LlmCallLog, RunRecord } from "../types";

export class BudgetExceeded extends Error {}

/** Per-run bookkeeping: every model call goes through here so cost, latency and I/O land in the transcript. */
export class RunCtx {
  private spentAtStart = 0;
  constructor(public run: RunRecord) {}

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
    const r = await fn();
    this.run.stages.push({ name, ms: Date.now() - t0, costUsd: this.run.totalCostUsd - costBefore, ...(counts?.(r) ?? {}) });
    await saveRun(this.run);
    return r;
  }

  /** Structured LLM call (optionally with tools). */
  async object<S extends z.ZodType>(stage: string, args: { model: string; system?: string; prompt: string; schema: S; tools?: ToolSet; logPrompt?: boolean }): Promise<z.infer<S>> {
    this.guard();
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: gw(args.model),
        system: args.system,
        prompt: args.prompt,
        tools: args.tools,
        output: Output.object({ schema: args.schema }),
        maxRetries: 2,
      });
      const toolCalls = r.steps.flatMap((s) =>
        s.toolCalls.map((c) => ({
          name: c.toolName,
          input: c.input,
          output: s.toolResults.find((x) => x.toolCallId === c.toolCallId)?.output,
        })),
      );
      this.record({
        stage,
        model: args.model,
        ms: Date.now() - t0,
        costUsd: r.steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0) || gatewayCost(r.providerMetadata),
        inputTokens: r.totalUsage.inputTokens,
        outputTokens: r.totalUsage.outputTokens,
        prompt: args.logPrompt === false ? undefined : args.prompt,
        output: r.output,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      });
      return r.output as z.infer<S>;
    } catch (e) {
      this.record({ stage, model: args.model, ms: Date.now() - t0, costUsd: 0, prompt: args.prompt, error: (e as Error).message });
      throw e;
    }
  }

  /** Free-form tool loop (used for web leads). Returns text + every tool call. */
  async agent(stage: string, args: { model: string; system?: string; prompt: string; tools: ToolSet; maxSteps: number }) {
    this.guard();
    const t0 = Date.now();
    const { isStepCount } = await import("ai");
    const r = await generateText({ model: gw(args.model), system: args.system, prompt: args.prompt, tools: args.tools, stopWhen: isStepCount(args.maxSteps) });
    const toolCalls = r.steps.flatMap((s) =>
      s.toolCalls.map((c) => ({ name: c.toolName, input: c.input, output: s.toolResults.find((x) => x.toolCallId === c.toolCallId)?.output })),
    );
    this.record({
      stage,
      model: args.model,
      ms: Date.now() - t0,
      costUsd: r.steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0),
      inputTokens: r.totalUsage.inputTokens,
      outputTokens: r.totalUsage.outputTokens,
      prompt: args.prompt,
      output: r.text,
      toolCalls,
    });
    return { text: r.text, toolCalls, sources: r.sources };
  }

  /** Jev (decision model): probability only, no text. Logged in aggregate to keep transcripts readable. */
  async jev(state: string, question: string): Promise<{ p: number; cost: number; ms: number }> {
    this.guard();
    const t0 = Date.now();
    const r = await decide({
      model: gw.decisionModel(experiment().jevModel),
      state,
      questions: { relevant: { type: "boolean", instructions: question } },
      maxRetries: 3,
    });
    const cost = gatewayCost((r as unknown as { providerMetadata?: unknown }).providerMetadata);
    this.run.totalCostUsd += cost;
    const a = r.answers.relevant as { probability?: number };
    return { p: a.probability ?? 0, cost, ms: Date.now() - t0 };
  }
}
