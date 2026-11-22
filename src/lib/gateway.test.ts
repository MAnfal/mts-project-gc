import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("gateway", () => {
  it("imports without a key, and names the missing variable only when a model is resolved", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const { languageModel, decisionModel } = await import("./gateway");
    expect(() => languageModel("anthropic/claude-sonnet-5.5")).toThrow(/AI_GATEWAY_API_KEY is not set/);
    expect(() => decisionModel("typesafe-ai/jev")).toThrow(/AI_GATEWAY_API_KEY is not set/);
  });

  it("with a key, resolves gateway models by id without any network call", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key-not-real");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { languageModel, decisionModel } = await import("./gateway");
    expect(languageModel("anthropic/claude-sonnet-5.5").modelId).toBe("anthropic/claude-sonnet-5.5");
    expect(decisionModel("typesafe-ai/jev").modelId).toBe("typesafe-ai/jev");
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("test resolvers replace both models, and null puts the gateway back", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    const { languageModel, setModelsForTests } = await import("./gateway");
    setModelsForTests({ language: (id) => ({ fake: id }), decision: (id) => ({ fake: id }) });
    expect(languageModel("x")).toEqual({ fake: "x" });
    setModelsForTests(null);
    expect(() => languageModel("x")).toThrow(/AI_GATEWAY_API_KEY is not set/);
  });

  it("reads the cost the gateway reports, and 0 when there is none or it is not a number", async () => {
    const { gatewayCost } = await import("./gateway");
    expect(gatewayCost({ gateway: { cost: "0.0123" } })).toBeCloseTo(0.0123);
    expect(gatewayCost({ gateway: { cost: 0.5 } })).toBe(0.5);
    expect(gatewayCost(undefined)).toBe(0);
    expect(gatewayCost({ gateway: { cost: "n/a" } })).toBe(0);
  });
});
