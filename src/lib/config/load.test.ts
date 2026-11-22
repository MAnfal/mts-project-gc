import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { readYaml } from "./load";
import { AppConfigSchema } from "./schemas";

// Each test writes a real YAML file to a temp config dir and reads it back through the loader,
// so the assertions are on what a caller of readYaml receives, not on the fixture text.
let configDir: string;

beforeEach(() => {
  configDir = fs.mkdtempSync(path.join(os.tmpdir(), "readyaml-"));
});

afterEach(() => {
  fs.rmSync(configDir, { recursive: true, force: true });
});

function writeConfig(rel: string, text: string) {
  const file = path.join(configDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

describe("readYaml", () => {
  it("rejects a wrong type with an error naming the file and the field", () => {
    writeConfig("app.yaml", "appName: 42\nmaxWindowDays: 7\n");
    let message = "";
    try {
      readYaml("app.yaml", AppConfigSchema, { configDir });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^Config error in config\/app\.yaml: appName: /);
  });

  it("names the nested field path, not just the top-level key", () => {
    writeConfig("nested/thing.yaml", "outer:\n  inner: nope\n");
    const schema = z.object({ outer: z.object({ inner: z.number() }) });
    expect(() => readYaml("nested/thing.yaml", schema, { configDir })).toThrow(
      /^Config error in config\/nested\/thing\.yaml: outer\.inner: /,
    );
  });

  it("reports a YAML syntax error against the file", () => {
    writeConfig("app.yaml", "appName: [unclosed\n");
    expect(() => readYaml("app.yaml", AppConfigSchema, { configDir })).toThrow(/^Config error in config\/app\.yaml: /);
  });

  it("reports a missing file against the file", () => {
    expect(() => readYaml("missing.yaml", AppConfigSchema, { configDir })).toThrow(/^Config error in config\/missing\.yaml: /);
  });

  it("returns the typed object for a valid file", () => {
    writeConfig("app.yaml", "appName: Reg Monitor\nmaxWindowDays: 7\n");
    const cfg = readYaml("app.yaml", AppConfigSchema, { configDir });
    expect(cfg).toEqual({ appName: "Reg Monitor", maxWindowDays: 7 });
  });

  it("reads config/ under process.cwd() by default, and the repo's app.yaml is valid", () => {
    const cfg = readYaml("app.yaml", AppConfigSchema);
    expect(cfg.appName).toBe("Reg Monitor");
    expect(cfg.maxWindowDays).toBe(7);
  });
});
