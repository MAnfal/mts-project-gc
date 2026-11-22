import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setModelsForTests } from "@/lib/gateway";
import { buildFollowUpContext } from "@/lib/runs/followup-context";
import { applyConfirmed, reduceEvents } from "@/lib/runs/reduce";
import type { ExampleRun } from "@/lib/runs/types";
import { readLines, stubStreamingModel, type StreamCall } from "./__fixtures__/stream-model";

const route = await import("./route");

const dir = path.resolve(import.meta.dirname, "../../../../public/examples");
const ex = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith("t6m4.json"))!), "utf8")) as ExampleRun;
const context = buildFollowUpContext(applyConfirmed(reduceEvents(ex.events), [], ex.profile.generalCounsel), ex.profile);
const valid = () => ({ context: structuredClone(context), messages: [{ role: "user", content: "Summarize for the CEO in 3 lines" }] });

const post = (r: { POST: typeof route.POST }, body: unknown) =>
  r.POST(new Request("http://localhost/api/followup", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

// What no answer may name: the configured model, the vendor, the key's variable, the config key.
const INTERNAL = /claude|anthropic|AI_GATEWAY|followUp|app\.yaml/i;

const savedKey = process.env.AI_GATEWAY_API_KEY;
afterEach(() => {
  setModelsForTests(null);
  if (savedKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = savedKey;
});

async function expectPlain(res: Response, status: number) {
  expect(res.status).toBe(status);
  expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  const text = await res.text();
  expect(text).not.toMatch(INTERNAL);
  return text;
}

describe("POST /api/followup: segment config", () => {
  it("runs on Node with a set maxDuration, and exports nothing but handlers and segment config", () => {
    expect(route.runtime).toBe("nodejs");
    expect(route.maxDuration).toBe(60);
    expect(Object.keys(route).sort()).toEqual(["POST", "maxDuration", "runtime"]);
  });
});

describe("POST /api/followup: bad requests get a plain 400 and never reach the model", () => {
  let calls: StreamCall[];
  const cases: [string, () => unknown][] = [
    ["a body that isn't JSON", () => "{not json"],
    ["a context without items", () => {
      const b = valid();
      delete (b.context as Partial<typeof context>).items;
      return b;
    }],
    ["a context with an internal field", () => {
      const b = valid();
      (b.context as unknown as Record<string, unknown>).debug = { model: "typesafe-ai/jev" };
      return b;
    }],
    ["a context naming an internal model in a title", () => {
      const b = valid();
      b.context.screenedOut[0].title = "Scored by typesafe-ai/jev";
      return b;
    }],
    ["21 turns", () => ({ ...valid(), messages: Array.from({ length: 21 }, (_, i) => ({ role: (20 - i) % 2 ? "assistant" : "user", content: `m${i}` })) })],
    ["a question over the message cap", () => ({ ...valid(), messages: [{ role: "user", content: "x".repeat(6001) }] })],
  ];
  for (const [name, body] of cases) {
    it(name, async () => {
      calls = stubStreamingModel(() => ({ text: ["unused"] }));
      const text = await expectPlain(await post(route, body()), 400);
      expect(text).not.toMatch(/typesafe|jev/i);
      expect(calls).toHaveLength(0);
    });
  }
});

describe("POST /api/followup: answers", () => {
  it("streams the answer as NDJSON, ending with a done line", async () => {
    const calls = stubStreamingModel(() => ({ text: ["Three items, ", "all sanctions."] }));
    const res = await post(route, valid());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(await readLines(res.body)).toEqual([{ type: "text", text: "Three items, " }, { type: "text", text: "all sanctions." }, { type: "done" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0].model).toBe("anthropic/claude-sonnet-5.5"); // config/app.yaml → followUp.model
  });

  it("with no Gateway key: a plain 503 that names neither the key's variable nor the model, and no spend", async () => {
    delete process.env.AI_GATEWAY_API_KEY; // the real gateway resolver, with no key: it must refuse before any request
    expect(await expectPlain(await post(route, valid()), 503)).toBe("Answers aren't available right now. Try again in a minute.");
  });

  it("a bad body is refused with 400 before the missing key is ever noticed", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    await expectPlain(await post(route, "{not json"), 400);
  });
});

describe("POST /api/followup: settings", () => {
  let cwd: string | undefined;
  let tmp: string | undefined;
  afterEach(() => {
    if (cwd) process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    cwd = tmp = undefined;
  });

  it("an unreadable followUp setting is a plain 500 that names no file or field, and calls no model", async () => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "followup-route-"));
    fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
    const app = path.join(tmp, "config", "app.yaml");
    fs.writeFileSync(app, fs.readFileSync(app, "utf8").replace(/^followUp:/m, "renamedAway:"));
    process.chdir(tmp);
    vi.resetModules();
    const fresh = await import("./route");
    const calls = stubStreamingModel(() => ({ text: ["unused"] }), (await import("@/lib/gateway")).setModelsForTests);
    expect(await expectPlain(await post(fresh, valid()), 500)).toBe("The server couldn't read its settings. Try again later.");
    expect(calls).toHaveLength(0);
  });
});
