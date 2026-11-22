import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { configHash } from "./config";

// configHash is stamped on every run so runs with different config are never compared like-for-like.
// Each test hashes a throwaway copy of the real config/ and edits that copy.
let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "confighash-"));
  fs.cpSync(path.join(process.cwd(), "config"), dir, { recursive: true });
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const append = (rel: string, text: string) => fs.appendFileSync(path.join(dir, rel), text);

describe("configHash", () => {
  it("hashes the repo's config/ by default, as a 10-hex-character digest", () => {
    expect(configHash()).toMatch(/^[0-9a-f]{10}$/);
    expect(configHash()).toBe(configHash(dir));
  });

  it("changes when a YAML file outside evalsets/ changes, nested ones included", () => {
    const before = configHash(dir);
    append("prompt-sets/strict.yaml", "\n# edit\n");
    expect(configHash(dir)).not.toBe(before);
  });

  it("ignores everything under evalsets/ and every non-YAML file", () => {
    const before = configHash(dir);
    append("evalsets/manifest.yaml", "\n# edit\n");
    append("evalsets/weeks/2026-11-02_2026-11-06.json", "\n");
    append("README.md", "\nedit\n");
    expect(configHash(dir)).toBe(before);
  });
});
