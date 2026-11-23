import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FrDoc } from "./types";

// Found 2026-11-21: 15 of 22 cached "full texts" were the Federal Register "Request Access" captcha page,
// so date extraction was reading a block page. Full text now comes from govinfo.gov (same GPO text).
const BLOCK = "<html><title>Federal Register :: Request Access</title> ... captcha ...</html>";
const REAL = "<html><pre>[Federal Register Volume 91] DATES: Comments must be received by December 10, 2026.</pre></html>";

const doc = { document_number: "2026-22866", publication_date: "2026-11-10", raw_text_url: "https://www.federalregister.gov/documents/full_text/text/2026/11/10/2026-22866.txt" } as FrDoc;

describe("getRawText", () => {
  let cwd: string;
  beforeEach(() => {
    cwd = process.cwd();
    process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "fr-")));
    vi.resetModules();
  });
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllGlobals();
  });

  it("reads govinfo first and strips HTML", async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(url.includes("govinfo.gov/content/pkg/FR-2026-11-10/html/2026-22866.htm") ? REAL : BLOCK));
    vi.stubGlobal("fetch", fetchMock);
    const { getRawText } = await import("./fr");
    const t = await getRawText(doc);
    expect(t).toContain("December 10, 2026");
    expect(t).not.toContain("<pre>");
  });

  it("keeps text after a literal '<' (govinfo serves '<=7.3 percent' unescaped inside <pre>)", async () => {
    // Found 2026-11-22: the tag strip deleted everything from "<=" to the next ">" — up to 34 KB, including the
    // whole power-bank passage of 2026-21922. Only real tags (<pre>, </pre>, <!-- -->) may be stripped.
    const page = "<html><pre>a concentration of <=7.3 percent.\n    Passengers may carry two power banks; see Table 3 > below.</pre></html>";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(page)));
    const { getRawText } = await import("./fr");
    const t = await getRawText(doc);
    expect(t).toContain("<=7.3 percent");
    expect(t).toContain("two power banks");
    expect(t).not.toContain("<pre>");
  });

  it("never returns or caches a block page; falls back to the FR raw text only if it is real", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(BLOCK)));
    const { getRawText } = await import("./fr");
    expect(await getRawText(doc)).toBe("");
    // A later successful fetch must not be shadowed by a cached block page.
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(url.includes("federalregister.gov") ? REAL : "", { status: url.includes("govinfo") ? 404 : 200 })));
    expect(await getRawText(doc)).toContain("December 10, 2026");
  });
});
