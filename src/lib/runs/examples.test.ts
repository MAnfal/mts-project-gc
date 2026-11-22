import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { shippedJson } from "../evals/__fixtures__/shipped";
import { assertPublic } from "../pipeline/events";
import { exampleLinks, loadExample, loadExampleIndex } from "./examples";
import { reduceEvents } from "./reduce";
import type { ExampleSummary } from "./types";

// Reads the generated files the GC's pages fetch (public/examples, from scripts/build-examples.sh), served the way a
// static host serves them.
const PUBLIC = path.resolve(import.meta.dirname, "../../../public");
function servePublic() {
  const requested: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const file = path.join(PUBLIC, url);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetch: f, requested };
}

describe("the generated examples", () => {
  it("are every finished example run in the bundle, and only those", async () => {
    const done = shippedJson<{ runId: string; status: string }[]>("user-view/runs-index.json").filter((r) => r.status === "done");
    const index = await loadExampleIndex(servePublic().fetch);
    expect(index.map((r) => r.id).sort()).toEqual(done.map((r) => r.runId).sort());
    expect(index).toHaveLength(9);
  });

  it("each renders as a finished report matching its index row, from public events only, fetching only its own file", async () => {
    const { fetch, requested } = servePublic();
    const index = await loadExampleIndex(fetch);
    for (const row of index) {
      const ex = await loadExample(row.id, fetch);
      for (const e of ex.events) assertPublic(e);
      const view = reduceEvents(ex.events);
      expect(view.status).toBe("done");
      expect(view.company).toBe(row.company);
      expect(view.items).toHaveLength(row.items);
      expect([view.windowStart, view.windowEnd]).toEqual([row.windowStart, row.windowEnd]);
      expect(ex.profile.name).toBe(row.company);
    }
    expect(requested.every((u) => u.startsWith("/examples/"))).toBe(true);
  });
});

describe("loadExample", () => {
  it("throws naming the example when its file is missing", async () => {
    await expect(loadExample("nope", servePublic().fetch)).rejects.toThrow("Example nope could not be loaded (404)");
  });

  it("throws when the file is not an example run", async () => {
    const f = (async () => new Response(JSON.stringify({ id: "x" }), { status: 200 })) as unknown as typeof fetch;
    await expect(loadExample("x", f)).rejects.toThrow("Example x is not an example run file");
  });

  it("throws naming the index when it can't be loaded", async () => {
    const f = (async () => new Response("gone", { status: 503 })) as unknown as typeof fetch;
    await expect(loadExampleIndex(f)).rejects.toThrow("/examples/index.json could not be loaded (503)");
  });

  it("throws when the index is not a list", async () => {
    const f = (async () => new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    await expect(loadExampleIndex(f)).rejects.toThrow("/examples/index.json is not a list of examples");
  });
});

describe("exampleLinks", () => {
  const row = (id: string, company: string, windowStart: string, windowEnd: string, items = 1): ExampleSummary => ({ id, company, windowStart, windowEnd, items });

  it("labels each by company and week, numbering runs of the same company and week oldest first", () => {
    const index = [row("c", "Ledgerly Inc.", "2026-11-09", "2026-11-13"), row("b", "Hearth Home Appliances", "2026-11-02", "2026-11-06"), row("a", "Ledgerly Inc.", "2026-11-09", "2026-11-13")];
    expect(exampleLinks(index)).toEqual([
      { id: "c", href: "/examples/c", label: "Ledgerly · Nov 9–13 · run 2" },
      { id: "b", href: "/examples/b", label: "Hearth · Nov 2–6" },
      { id: "a", href: "/examples/a", label: "Ledgerly · Nov 9–13 · run 1" },
    ]);
  });

  it("gives every generated example a distinct label", async () => {
    const links = exampleLinks(await loadExampleIndex(servePublic().fetch));
    expect(new Set(links.map((l) => l.label)).size).toBe(links.length);
  });
});
