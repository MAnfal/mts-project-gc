/**
 * Pure decisions behind scripts/build-eval-index.mts, kept here so this repo's vitest can test them.
 * That script runs under the POC checkout's tsx and does the file I/O. No fs, no POC imports.
 */

type RunLike = { id: string; config: { cell?: string; evalset?: string } };

/**
 * A suite's runs.jsonl.gz (what export.mts's arenaRuns() returned) plus every raw run file on poc that it
 * left out, appended in raw order and flagged `superseded: true`, so no recorded run is dropped.
 */
export function appendSkippedRuns<R extends { id: string }>(shipped: R[], raw: R[]): { runs: (R & { superseded?: true })[]; added: number } {
  const have = new Set(shipped.map((r) => r.id));
  const missing = raw.filter((r) => !have.has(r.id)).map((r) => ({ ...r, superseded: true as const }));
  return { runs: missing.length ? [...shipped, ...missing] : shipped, added: missing.length };
}

/**
 * One setup's runs pooled over the named suites. Throws if there are none, or if together they miss any
 * eval set in the manifest, so a wrong suite list cannot yield numbers over fewer company-weeks than intended.
 */
export function poolSetupRuns<R extends RunLike>(setup: string, suites: string[], runsOf: (suiteId: string) => R[], evalsetIds: string[]): R[] {
  const pooled = suites.flatMap((id) => runsOf(id)).filter((r) => r.config.cell === setup);
  if (!pooled.length) throw new Error(`no runs of setup ${setup} in ${suites.join(", ")}`);
  const covered = new Set(pooled.map((r) => r.config.evalset));
  const uncovered = evalsetIds.filter((e) => !covered.has(e));
  if (uncovered.length) throw new Error(`setup ${setup} in ${suites.join(", ")} misses eval sets: ${uncovered.join(", ")}`);
  return pooled;
}

/** The baseline setup: the single setups.yaml entry with `method: baseline`. */
export function pickBaselineSetup(setups: { id: string; method: string }[]): string {
  const b = setups.filter((s) => s.method === "baseline");
  if (b.length !== 1) throw new Error(`expected one baseline setup in setups.yaml, found ${b.length}`);
  return b[0].id;
}

/**
 * export.mts stamps `exportedAt` on every manifest.json. Keep the committed file when that stamp is the only
 * difference, so a rebuild from an unchanged `poc` leaves public/evals byte-identical.
 */
export function keepManifest(previous: string | null, next: string): string {
  if (previous === null) return next;
  try {
    const strip = (text: string) => {
      const { exportedAt: _ignored, ...rest } = JSON.parse(text) as Record<string, unknown>;
      void _ignored;
      return JSON.stringify(rest);
    };
    return strip(previous) === strip(next) ? previous : next;
  } catch {
    return next;
  }
}
