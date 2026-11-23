import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MockLanguageModelV4 } from "ai/test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setModelsForTests } from "@/lib/gateway";

const { POST } = await import("./route");

const post = (route: { POST: typeof POST }, body: unknown) =>
  route.POST(new Request("http://localhost/api/suggest-areas", { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }));

const USAGE = {
  inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};
let modelCalls = 0;
function stubModel(output: unknown, set: typeof setModelsForTests = setModelsForTests) {
  set({
    language: (model) =>
      new MockLanguageModelV4({
        modelId: model,
        doGenerate: async () => {
          modelCalls++;
          return { content: [{ type: "text", text: JSON.stringify(output) }], finishReason: { unified: "stop", raw: "stop" }, usage: USAGE, warnings: [] };
        },
      }),
    decision: () => {
      throw new Error("unused");
    },
  });
}

const savedKey = process.env.AI_GATEWAY_API_KEY;
afterEach(() => {
  setModelsForTests(null);
  modelCalls = 0;
  if (savedKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = savedKey;
});

describe("POST /api/suggest-areas: input guard", () => {
  it("answers 400 with a plain sentence on an empty description, and never calls the model", async () => {
    stubModel({ areas: [{ id: "Tax", description: "1099" }] });
    const res = await post({ POST }, { description: "  " });
    expect(res.status).toBe(400);
    expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await res.text()).toBe("Describe what the company does first, then ask for suggestions.");
    expect(modelCalls).toBe(0);
  });

  it("answers 400 on a body that isn't JSON", async () => {
    stubModel({ areas: [] });
    const res = await post({ POST }, "{not json");
    expect(res.status).toBe(400);
    expect(modelCalls).toBe(0);
  });
});

describe("POST /api/suggest-areas: suggestions", () => {
  it("returns the proposed areas as JSON, owner left for the GC, and nothing that names the model", async () => {
    stubModel({ areas: [{ id: "Product safety", description: "CPSC recalls" }] });
    const res = await post({ POST }, { description: "Makes widgets." });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ areas: [{ id: "Product safety", description: "CPSC recalls" }] });
    expect(text).not.toMatch(/claude|anthropic|owner/i);
    expect(modelCalls).toBe(1);
  });

  it("with no Gateway key: a plain 503 that names neither the key's variable nor the model, and no spend", async () => {
    delete process.env.AI_GATEWAY_API_KEY; // the real gateway resolver, with no key: it must refuse before any request
    const res = await post({ POST }, { description: "Makes widgets." });
    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).toBe("Suggestions aren't available right now. Add the areas yourself, or try again later.");
    expect(text).not.toMatch(/AI_GATEWAY|claude|anthropic/i);
  });
});

describe("POST /api/suggest-areas: settings", () => {
  let cwd: string | undefined;
  let tmp: string | undefined;
  afterEach(() => {
    if (cwd) process.chdir(cwd);
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
    cwd = tmp = undefined;
  });

  it("an unreadable suggestAreas setting is a plain 500 that names no file or field", async () => {
    cwd = process.cwd();
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "suggest-route-"));
    fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
    const app = path.join(tmp, "config", "app.yaml");
    fs.writeFileSync(app, fs.readFileSync(app, "utf8").replace(/^suggestAreas:/m, "renamedAway:"));
    process.chdir(tmp);
    vi.resetModules();
    const route = await import("./route");
    stubModel({ areas: [] }, (await import("@/lib/gateway")).setModelsForTests); // the fresh module graph's seam
    const res = await post(route, { description: "Makes widgets." });
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe("The server couldn't read its settings. Add the areas yourself, or try again later.");
    expect(text).not.toMatch(/app\.yaml|suggestAreas/);
    expect(modelCalls).toBe(0);
  });
});
