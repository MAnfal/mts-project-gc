import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/**
 * Node-side access to the real generated bundle (public/evals, built by scripts/build-eval-bundle.sh), for tests
 * that must run against shipped data rather than hand-made fixtures (bibles/swe/testing.md). Pages read the same
 * files through loader.ts; `stubFetch` serves a directory to it the way a static host does.
 */
export const BUNDLE = path.resolve(import.meta.dirname, "../../../../public/evals");

const jsonLines = <T>(file: string): T[] =>
  zlib
    .gunzipSync(fs.readFileSync(file))
    .toString("utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);

export const shippedSuiteIds = (): string[] => fs.readdirSync(path.join(BUNDLE, "suites")).sort();
export const shippedRuns = <T = Record<string, unknown>>(suite: string): T[] => jsonLines<T>(path.join(BUNDLE, "suites", suite, "runs.jsonl.gz"));
export const shippedTrace = <T = Record<string, unknown>>(suite: string, runId: string): T[] =>
  jsonLines<T>(path.join(BUNDLE, "suites", suite, "traces", `${runId}.jsonl.gz`));
export const shippedJson = <T = unknown>(rel: string): T => JSON.parse(fs.readFileSync(path.join(BUNDLE, rel), "utf8")) as T;
export const shippedKey = <T = unknown>(evalset: string): T => shippedJson<T>(`config/evalsets/keys/${evalset}.json`);

/** Serves `dir` at `/evals/...`, 404 for anything else. Bodies are raw bytes, as a static host sends a .gz. */
export function stubFetch(dir: string) {
  const requested: string[] = [];
  const f = async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    const rel = url.replace(/^\/evals\//, "");
    const file = path.join(dir, rel);
    if (!url.startsWith("/evals/") || !fs.existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(fs.readFileSync(file), { status: 200, headers: { "content-type": "application/gzip" } });
  };
  return { fetch: f as typeof fetch, requested };
}
