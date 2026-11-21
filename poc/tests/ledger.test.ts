import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("spend ledger (spend survives deleting old runs)", () => {
  const cwd = process.cwd();
  afterEach(() => {
    process.chdir(cwd);
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("spentUsd = saved runs + archived spend in data/spend-ledger.json + smoke spend", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-"));
    vi.stubEnv("POC_CONFIG_DIR", path.resolve(cwd, "config"));
    process.chdir(dir);
    fs.mkdirSync("data/runs", { recursive: true });
    fs.writeFileSync("data/runs/r1.json", JSON.stringify({ id: "r1", createdAt: "1", config: {}, status: "done", stages: [], calls: [], totalCostUsd: 1, totalMs: 0, panel: { costUsd: 0.5 } }));
    vi.resetModules();
    const store = await import("../src/lib/store");
    const base = await store.spentUsd();
    await store.archiveSpend({ reason: "deleted old arenas", runs: 10, usd: 7.25 });
    expect(await store.spentUsd()).toBeCloseTo(base + 7.25);
    const ledger = JSON.parse(fs.readFileSync("data/spend-ledger.json", "utf8"));
    expect(ledger.entries).toHaveLength(1);
    expect(ledger.entries[0]).toMatchObject({ reason: "deleted old arenas", runs: 10, usd: 7.25 });
  });
});
