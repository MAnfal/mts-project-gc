// Pre-compute user-view runs (winning setup on the demo companies) so the user view opens instantly.
//   npx tsx scripts/prerun.mts            # every demo company × every eval week
import { cellByKey, cellConfig } from "../src/lib/arena";
import { companies, experiment, manifest, pinConfig } from "../src/lib/config";
import { execute, newRun } from "../src/lib/pipeline/run";

pinConfig();
const cell = cellByKey(experiment().userView.setup)!;
const demos = companies().filter((c) => c.use === "demo");
const jobs = demos.flatMap((c) => manifest().weeks.map((w) => ({ c, w })));
await Promise.all(
  jobs.map(async ({ c, w }) => {
    const cfg = cellConfig(cell, { profileId: c.id, windowStart: w.windowStart, windowEnd: w.windowEnd, asOf: w.asOf }, "user-view");
    const r = await execute(newRun({ ...cfg, arena: undefined, group: "user-view" }));
    console.log(c.id, w.id, r.status, `${r.items?.length ?? 0} items`, `$${r.totalCostUsd.toFixed(3)}`, r.error ?? "");
  }),
);
