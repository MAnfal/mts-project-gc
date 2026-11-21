import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Experimental_DecisionMockModelV4 as DecisionMock, MockLanguageModelV4 } from "ai/test";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The execution trace must let a reader replay every step of a run: what each model was asked (system + prompt),
 * what it answered, what every decision was (filter, verify, tier, owner, action guardrail), and what it cost.
 * This runs the REAL pipeline on a 3-doc frozen week with fake models and a stubbed network, so it costs nothing.
 */

const CFG = path.resolve(__dirname, "../config");
const WEEK = [
  { document_number: "2026-00001", type: "Proposed Rule", title: "Orange dye on casings", abstract: "FDA dye rule", agencies: [{ name: "Food and Drug Administration" }], publication_date: "2026-11-10", effective_on: null, comments_close_on: "2026-12-10", dates: "Comments by December 10, 2026.", citation: "91 FR 1", cfr_references: [], html_url: "https://www.federalregister.gov/d/2026-00001", raw_text_url: null, action: "Proposed rule" },
  { document_number: "2026-00002", type: "Notice", title: "Boeing 787 directive", abstract: "aircraft", agencies: [{ name: "Federal Aviation Administration" }], publication_date: "2026-11-10", effective_on: null, comments_close_on: null, dates: null, citation: "91 FR 2", cfr_references: [], html_url: "https://www.federalregister.gov/d/2026-00002", raw_text_url: null, action: null },
  { document_number: "2026-00003", type: "Notice", title: "Fishing quotas", abstract: "fish", agencies: [{ name: "NOAA" }], publication_date: "2026-11-11", effective_on: null, comments_close_on: null, dates: null, citation: "91 FR 3", cfr_references: [], html_url: "https://www.federalregister.gov/d/2026-00003", raw_text_url: null, action: null },
];

let dir: string;
let cwd: string;

const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } };
const reply = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj) }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [], providerMetadata: { gateway: { cost: "0.001" } } });

function fakeLanguageModel() {
  return new MockLanguageModelV4({
    doGenerate: async (opts) => {
      const text = JSON.stringify(opts.prompt);
      if (text.includes("=== DOCUMENTS")) return reply({ decisions: [{ document_number: "2026-00001", relevant: true, reason: "Our hot dogs use casings", areas: ["food-safety"] }] });
      if (text.includes("Extract every dated")) return reply({ deadlines: [{ date: "2026-12-10", kind: "comment", quote: "Comments by December 10, 2026." }] });
      if (text.includes("Write one action item")) return reply({ actions: [{ document_number: "2026-00001", action: "Check casings before December 10, 2026." }] });
      if (text.includes("one judge on a panel")) return reply({ votes: [{ document_number: "2026-00001", criterion: "clear", verdict: "PASS", why: "ok" }, { document_number: "2026-00001", criterion: "grounded", verdict: "PASS", why: "ok" }] });
      if (text.includes("Convert your research")) return reply({ items: [{ document_number: "2026-00001", title: "x", url: "", deadline: "2026-12-10", deadline_kind: "comment", tier: "Critical", owner_area: "food-safety", reason: "r", action: "a" }, { document_number: "2026-99999", title: "made up", url: "", deadline: null, deadline_kind: null, tier: "Low", owner_area: "x", reason: "r", action: "a" }] });
      return { content: [{ type: "text" as const, text: "research notes: 2026-00001 matters" }], finishReason: { unified: "stop" as const, raw: "stop" }, usage, warnings: [], providerMetadata: { gateway: { cost: "0.002" } } };
    },
  });
}

beforeAll(async () => {
  cwd = process.cwd();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "trace-"));
  fs.cpSync(CFG, path.join(dir, "config"), { recursive: true });
  fs.writeFileSync(path.join(dir, "config/evalsets/weeks/2026-11-09_2026-11-13.json"), JSON.stringify(WEEK));
  process.chdir(dir);
  vi.stubEnv("POC_CONFIG_DIR", path.join(dir, "config"));
  vi.stubEnv("VERCEL_AI_GATEWAY_API_KEY", "test");
  vi.stubGlobal("fetch", async (url: string) => {
    const doc = WEEK.find((d) => url.includes(d.document_number));
    if (url.includes("/api/v1/documents/") && doc) return new Response(JSON.stringify(doc));
    if (url.includes("govinfo") && doc) return new Response(`<pre>${doc.title}. ${doc.dates ?? ""}</pre>`);
    return new Response("", { status: 404 });
  });
  vi.resetModules();
  const gateway = await import("../src/lib/gateway");
  gateway.setModelsForTests({
    language: () => fakeLanguageModel(),
    decision: () => new DecisionMock({ doDecide: async (o) => ({ answers: { relevant: { type: "boolean", probability: JSON.stringify(o.state).includes("Orange dye") ? 0.9 : 0.01 } }, warnings: [], usage: { inputTokens: 5, outputTokens: 1 }, providerMetadata: { gateway: { cost: "0.0001" } } }) as never }),
  });
});

afterAll(() => {
  process.chdir(cwd);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// No arena → the runs land in the user-view scope: data/user-view/traces/<id>.jsonl.
const readTrace = (id: string) => fs.readFileSync(path.join(dir, "data/user-view/traces", `${id}.jsonl`), "utf8").trim().split("\n").map((l) => JSON.parse(l));

describe("execution trace (JSONL, one per run)", () => {
  it("pipeline: every model call, decision, check and cost is recorded in order", async () => {
    const { execute, newRun } = await import("../src/lib/pipeline/run");
    const run = await execute(newRun({ mode: "pipeline", profileId: "brightside", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13", model: "anthropic/claude-sonnet-5.5", filter: "jev+llm", jevThreshold: 0.1, webLeads: false }));
    expect(run.status, run.error).toBe("done");
    const t = readTrace(run.id);
    const types = t.map((e) => e.type);

    expect(t.map((e) => e.seq)).toEqual(t.map((_, i) => i));
    expect(types[0]).toBe("run.start");
    expect(types.at(-1)).toBe("run.end");
    expect(t[0].configHash).toBeTruthy();
    expect(t[0].profile.id).toBe("brightside");
    expect(Object.keys(t[0].prompts)).toContain("filterSystem");

    // Jev: one call per doc, with what it was asked and what it said.
    const jev = t.filter((e) => e.type === "jev.call");
    expect(jev).toHaveLength(3);
    expect(jev[0]).toMatchObject({ question: expect.any(String), state: expect.any(String), probability: expect.any(Number), costUsd: expect.any(Number) });

    // Every LLM call carries system + prompt + output + cost.
    const llm = t.filter((e) => e.type === "llm.call");
    expect(llm.length).toBeGreaterThanOrEqual(3);
    for (const c of llm) expect(c).toMatchObject({ stage: expect.any(String), model: expect.any(String), system: expect.any(String), prompt: expect.any(String), costUsd: expect.any(Number), ms: expect.any(Number) });
    expect(llm.find((c) => c.stage.startsWith("extract-dates"))?.prompt).toContain("December 10, 2026");

    // Decisions for every doc, not just the kept ones.
    const dec = t.filter((e) => e.type === "filter.decision");
    expect(dec.map((d) => d.document_number).sort()).toEqual(["2026-00001", "2026-00002", "2026-00003"]);
    expect(dec.find((d) => d.document_number === "2026-00002")).toMatchObject({ jevProbability: 0.01, passedJev: false, relevant: false });

    // Verify / tier / owner / action-guardrail steps.
    // The comment date comes from the FR field (verified on re-fetch); the model's identical extraction is kept as a recorded duplicate.
    expect(t.find((e) => e.type === "verify.doc")).toMatchObject({
      document_number: "2026-00001",
      refetched: true,
      textSource: "govinfo",
      fieldChecks: [expect.objectContaining({ date: "2026-12-10", verified: true })],
      extractedDuplicatesOfFields: [expect.objectContaining({ date: "2026-12-10", quote: "Comments by December 10, 2026." })],
    });
    expect(t.find((e) => e.type === "tier.assign")).toMatchObject({ document_number: "2026-00001", tier: "Critical" });
    expect(t.find((e) => e.type === "owner.assign")).toMatchObject({ document_number: "2026-00001", areas: ["food-safety"] });
    expect(t.find((e) => e.type === "action.write")).toMatchObject({ raw: expect.stringContaining("December 10, 2026"), final: expect.not.stringContaining("December 10, 2026"), stripped: true });

    // Stage boundaries with cost, and a final total that matches the run record.
    expect(types.filter((x) => x === "stage.end").length).toBeGreaterThanOrEqual(4);
    expect(t.at(-1)).toMatchObject({ status: "done", totalCostUsd: run.totalCostUsd, items: 1 });

    // The real trace passes every process check.
    const { checkTrace } = await import("../src/lib/trace-checks");
    expect(checkTrace(t).filter((c) => !c.pass)).toEqual([]);
  });

  it("baseline: what the model claimed and how each claim was resolved or dropped", async () => {
    const { execute, newRun } = await import("../src/lib/pipeline/run");
    const run = await execute(newRun({ mode: "baseline", profileId: "brightside", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13", model: "anthropic/claude-sonnet-5.5", filter: "jev+llm", jevThreshold: 0.1, webLeads: false }));
    expect(run.status, run.error).toBe("done");
    const t = readTrace(run.id);
    const res = t.filter((e) => e.type === "baseline.resolve");
    expect(res.find((e) => e.document_number === "2026-00001")).toMatchObject({ outcome: "kept", date: { claimed: "2026-12-10", verified: true } });
    expect(res.find((e) => e.document_number === "2026-99999")).toMatchObject({ outcome: "dropped", why: expect.stringMatching(/does not exist/) });
    const { checkTrace } = await import("../src/lib/trace-checks");
    expect(checkTrace(t).filter((c) => !c.pass)).toEqual([]);
  });

  it("judge panel votes land in the same trace", async () => {
    const { execute, newRun } = await import("../src/lib/pipeline/run");
    const { judgePanel } = await import("../src/lib/panel");
    const run = await execute(newRun({ mode: "pipeline", profileId: "brightside", windowStart: "2026-11-09", windowEnd: "2026-11-13", asOf: "2026-11-13", model: "anthropic/claude-sonnet-5.5", filter: "jev+llm", jevThreshold: 0.1, webLeads: false }));
    await judgePanel(run);
    const t = readTrace(run.id);
    expect(t.filter((e) => e.type === "judge.call").length).toBe(3);
    expect(t.filter((e) => e.type === "judge.verdict").length).toBeGreaterThan(0);
    expect(t.find((e) => e.type === "judge.call")).toMatchObject({ model: expect.any(String), prompt: expect.any(String), votes: expect.any(Array), costUsd: expect.any(Number) });
  });
});
