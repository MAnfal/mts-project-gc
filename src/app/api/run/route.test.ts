import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installModels, restoreModels, type JevCall } from "@/lib/pipeline/__fixtures__/harness";
import { UNEXPECTED_MESSAGE, type RunEvent } from "@/lib/pipeline/events";
import type { CompanyProfile } from "@/lib/types";

// Count runPipeline calls while keeping the real pipeline, so "starts no run" is observed, not inferred.
const pipeline = vi.hoisted(() => ({ calls: 0 }));
vi.mock("@/lib/pipeline/run", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/pipeline/run")>();
  return { ...real, runPipeline: (...args: Parameters<typeof real.runPipeline>) => (pipeline.calls++, real.runPipeline(...args)) };
});

const { POST, maxDuration, runtime } = await import("./route");

const post = (body: unknown) =>
  POST(new Request("http://localhost/api/run", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));
const eventsOf = async (res: Response) =>
  (await res.text())
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunEvent);

// No model and no network: the decision model answers 0 for every document (nothing passes the relevance cut), and
// Nov 2–6 is a frozen eval week read from config/, so the pipeline needs nothing else.
let jev: JevCall[];
let fetched: string[];
const realFetch = globalThis.fetch;
beforeEach(() => {
  pipeline.calls = 0;
  fetched = [];
  jev = installModels({ jev: () => 0, llm: () => ({ decisions: [], deadlines: [], actions: [] }) }).jev;
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    return new Response("offline", { status: 503 });
  }) as typeof fetch;
});
afterEach(() => {
  restoreModels();
  globalThis.fetch = realFetch;
});

describe("POST /api/run: segment config", () => {
  it("declares the 300 s function budget on the Node runtime", () => {
    expect(maxDuration).toBe(300);
    expect(runtime).toBe("nodejs");
  });
});

describe("POST /api/run: rejected bodies get a plain 400 and start no run", () => {
  it.each([
    ["an unknown profileId", { profileId: "nope", windowStart: "2026-11-02", windowEnd: "2026-11-06" }, "Unknown company profile"],
    ["an eval company (brightside)", { profileId: "brightside", windowStart: "2026-11-02", windowEnd: "2026-11-06" }, "Unknown company profile"],
    ["an 8-day window", { profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-09" }, "at most 7 days"],
    ["a 30-day window", { profileId: "ledgerly", windowStart: "2026-11-01", windowEnd: "2026-11-30" }, "at most 7 days"],
    ["windowEnd before windowStart", { profileId: "ledgerly", windowStart: "2026-11-06", windowEnd: "2026-11-02" }, "ends before it starts"],
    ["a custom profile missing summary", { customProfile: { id: "x", name: "X" }, windowStart: "2026-11-02", windowEnd: "2026-11-06" }, "summary"],
    ["a malformed date", { profileId: "ledgerly", windowStart: "2026-02-30", windowEnd: "2026-11-06" }, "YYYY-MM-DD"],
    ["a body that isn't JSON", "{not json", "Send a JSON object"],
  ])("%s", async (_, body, needle) => {
    const res = await post(body);
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    const text = await res.text();
    expect(text).toContain(needle);
    expect(text).not.toMatch(/Error|at \/|\.ts:|zod|config\//);
    expect(pipeline.calls).toBe(0);
    expect(jev).toHaveLength(0);
  });
});

describe("POST /api/run: a valid body streams the run as NDJSON", () => {
  it("one RunEvent per line, from run.start to exactly one terminal run.done", async () => {
    const res = await post({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    const events = await eventsOf(res);
    expect(events[0]).toMatchObject({ type: "run.start", company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06" });
    expect(events.filter((e) => e.type === "run.done" || e.type === "run.failed").map((e) => e.type)).toEqual(["run.done"]);
    expect(events.at(-1)).toMatchObject({ type: "run.done", scanned: 466, items: [] });
    expect(pipeline.calls).toBe(1);
    expect(jev.length).toBe(466);
    expect(jev[0].state).toContain("Company: Ledgerly Inc.");
    expect(fetched).toEqual([]);
  }, 60_000);

  it("runs a custom profile from the body, and leaves config/companies untouched", async () => {
    const dir = path.join(process.cwd(), "config/companies");
    const snapshot = () => fs.readdirSync(dir).sort().map((f) => [f, fs.readFileSync(path.join(dir, f), "utf8")]);
    const before = snapshot();
    const customProfile: CompanyProfile = {
      id: "acme",
      use: "demo",
      name: "Acme Kettles",
      summary: "Acme makes electric kettles sold in US retail stores.",
      businessLines: ["Kettles"],
      applies: ["CPSC product safety"],
      doesNotApply: ["Banking"],
      areas: { safety: { description: "Product safety", owner: { name: "Ann Lee", email: "ann@acme.example" } } },
      generalCounsel: { name: "Gail Counsel", email: "gc@acme.example" },
    };
    const events = await eventsOf(await post({ customProfile, windowStart: "2026-11-02", windowEnd: "2026-11-06" }));
    expect(events[0]).toMatchObject({ type: "run.start", company: "Acme Kettles" });
    expect(events.at(-1)?.type).toBe("run.done");
    expect(jev.every((c) => c.state.includes("Acme makes electric kettles sold in US retail stores."))).toBe(true);
    expect(jev.some((c) => c.state.includes("Ledgerly"))).toBe(false);
    expect(snapshot()).toEqual(before);
  }, 60_000);
});

describe("POST /api/run: a server-side config problem", () => {
  let cwd: string | undefined;
  let tmp: string | undefined;
  afterEach(() => {
    if (cwd) process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    cwd = tmp = undefined;
  });

  it("arrives as one run.failed event with no step and a fixed message, never a 500 with a stack", async () => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "run-route-"));
    fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
    const exp = path.join(tmp, "config/experiment.yaml");
    fs.writeFileSync(exp, fs.readFileSync(exp, "utf8").replace("setup: jev-sonnet-strict-passages", "setup: no-such-setup"));
    process.chdir(tmp);
    vi.resetModules();
    const route = await import("./route");
    const res = await route.POST(new Request("http://localhost/api/run", { method: "POST", body: JSON.stringify({ profileId: "ledgerly", windowStart: "2026-11-02", windowEnd: "2026-11-06" }) }));
    expect(res.status).toBe(200);
    expect(await eventsOf(res)).toEqual([{ type: "run.failed", step: null, message: UNEXPECTED_MESSAGE }]);
    expect(pipeline.calls).toBe(0);
  });
});
