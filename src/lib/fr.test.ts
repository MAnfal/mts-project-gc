import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrDoc } from "./types";

// The HTTP cache is a module-level Map, so every test imports a fresh copy of ./fr.
beforeEach(() => {
  vi.resetModules();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const offline = () =>
  vi.fn(async (): Promise<Response> => {
    throw new Error("network disabled in this test");
  });
const apiPage = (results: Partial<FrDoc>[]) => new Response(JSON.stringify({ results, total_pages: 1 }));

describe("listWindow on a frozen eval week", () => {
  it("returns the week's 466 documents from config/evalsets/weeks with no network", async () => {
    const fetchMock = offline();
    vi.stubGlobal("fetch", fetchMock);
    const { listWindow } = await import("./fr");
    const docs = await listWindow("2026-11-02", "2026-11-06");
    expect(docs).toHaveLength(466);
    expect(docs.every((d) => d.publication_date >= "2026-11-02" && d.publication_date <= "2026-11-06")).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the live API for any other window (and fails here, offline)", async () => {
    vi.stubGlobal("fetch", offline());
    const { listWindow } = await import("./fr");
    await expect(listWindow("2026-11-16", "2026-11-20")).rejects.toThrow("network disabled in this test");
  });
});

describe("in-memory HTTP cache (replaces the POC's data/cache on disk)", () => {
  it("serves a repeated live window from memory, and useCache=false fetches again", async () => {
    const fetchMock = vi.fn(async () => apiPage([{ document_number: "2026-90001" }]));
    vi.stubGlobal("fetch", fetchMock);
    const { listWindow } = await import("./fr");
    const first = await listWindow("2026-11-16", "2026-11-20");
    const second = await listWindow("2026-11-16", "2026-11-20");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.map((d) => d.document_number)).toEqual(["2026-90001"]);
    expect(String(fetchMock.mock.calls[0])).toContain("conditions%5Bpublication_date%5D%5Bgte%5D=2026-11-16");

    await listWindow("2026-11-16", "2026-11-20", false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(first).toEqual(second);
  });

  it("hands each caller its own copy, so mutating one result cannot change the next", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => apiPage([{ document_number: "2026-90001" }])));
    const { listWindow } = await import("./fr");
    const first = await listWindow("2026-11-16", "2026-11-20");
    first.push({ document_number: "planted" } as FrDoc);
    first[0].title = "planted";
    const second = await listWindow("2026-11-16", "2026-11-20");
    expect(second).toHaveLength(1);
    expect(second[0].title).toBeUndefined();
  });

  it("getDoc re-fetches every time by default (it is the verification read)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ document_number: "2026-90001" })));
    vi.stubGlobal("fetch", fetchMock);
    const { getDoc } = await import("./fr");
    await getDoc("2026-90001");
    await getDoc("2026-90001");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await getDoc("2026-90001", true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("getDoc with useCache=true keeps a failed lookup (null) as a cache hit, as the POC's file cache did", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { getDoc } = await import("./fr");
    expect(await getDoc("2026-90002", true)).toBeNull();
    expect(await getDoc("2026-90002", true)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("full text is fetched once per document; the second read reports source 'cache'", async () => {
    const fetchMock = vi.fn(async () => new Response("<pre>DATES: effective December 10, 2026.</pre>"));
    vi.stubGlobal("fetch", fetchMock);
    const { getRawTextWithSource } = await import("./fr");
    const doc = { document_number: "2026-22866", publication_date: "2026-11-10" } as FrDoc;
    const first = await getRawTextWithSource(doc);
    const second = await getRawTextWithSource(doc);
    expect(first.source).toBe("govinfo");
    expect(second).toEqual({ text: first.text, source: "cache" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
