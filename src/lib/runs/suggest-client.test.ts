import { describe, expect, it } from "vitest";
import { requestSuggestions, SUGGEST_UNAVAILABLE } from "./suggest-client";

const plain = (text: string, status: number) => new Response(text, { status, headers: { "content-type": "text/plain; charset=utf-8" } });
const fetchReturning = (res: Response | (() => never)) => {
  const calls: { url: string; body: unknown }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push({ url, body: JSON.parse(String(init?.body)) });
    return typeof res === "function" ? res() : res;
  }) as unknown as typeof fetch;
  return { f, calls };
};

describe("requestSuggestions (the browser side of 'Suggest from description')", () => {
  it("posts the description and returns the proposed areas", async () => {
    const { f, calls } = fetchReturning(Response.json({ areas: [{ id: "Product safety", description: "CPSC recalls" }] }));
    expect(await requestSuggestions("Makes widgets.", f)).toEqual({ ok: true, areas: [{ id: "Product safety", description: "CPSC recalls" }] });
    expect(calls).toEqual([{ url: "/api/suggest-areas", body: { description: "Makes widgets." } }]);
  });

  it("shows the server's own plain sentence when it refuses (400, 503)", async () => {
    const { f } = fetchReturning(plain("Describe what the company does first, then ask for suggestions.", 400));
    expect(await requestSuggestions(" ", f)).toEqual({ ok: false, message: "Describe what the company does first, then ask for suggestions." });
  });

  it("never shows a body that isn't the route's plain text (an HTML error page, a platform timeout)", async () => {
    const { f } = fetchReturning(new Response("<html><body>Internal Server Error</body></html>", { status: 500, headers: { "content-type": "text/html" } }));
    expect(await requestSuggestions("Makes widgets.", f)).toEqual({ ok: false, message: SUGGEST_UNAVAILABLE });
  });

  it("an empty plain body falls back to the fixed sentence", async () => {
    const { f } = fetchReturning(plain("  ", 502));
    expect(await requestSuggestions("Makes widgets.", f)).toEqual({ ok: false, message: SUGGEST_UNAVAILABLE });
  });

  it("a network failure is the fixed sentence, not a thrown error", async () => {
    const { f } = fetchReturning(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestSuggestions("Makes widgets.", f)).toEqual({ ok: false, message: SUGGEST_UNAVAILABLE });
  });

  it("a 200 without an areas list is the fixed sentence; malformed entries are dropped", async () => {
    expect(await requestSuggestions("x", fetchReturning(Response.json({ nope: 1 })).f)).toEqual({ ok: false, message: SUGGEST_UNAVAILABLE });
    const mixed = Response.json({ areas: [{ id: "Tax", description: "1099" }, { id: 3 }, null] });
    expect(await requestSuggestions("x", fetchReturning(mixed).f)).toEqual({ ok: true, areas: [{ id: "Tax", description: "1099" }] });
  });
});
