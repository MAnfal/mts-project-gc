import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import YAML from "yaml";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// config.ts reads config/ under process.cwd(). Each test runs in a temp directory holding a copy of the
// real config/, breaks one thing in that copy, and imports a fresh config.ts (its file cache is per module).
let cwd: string;
let tmp: string;
beforeEach(() => {
  cwd = process.cwd();
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "config-validation-"));
  fs.cpSync(path.join(cwd, "config"), path.join(tmp, "config"), { recursive: true });
  process.chdir(tmp);
  vi.resetModules();
});
afterEach(() => {
  process.chdir(cwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

const file = (rel: string) => path.join(tmp, "config", rel);
const editYaml = (rel: string, edit: (doc: Record<string, unknown>) => void) => {
  const doc = YAML.parse(fs.readFileSync(file(rel), "utf8"));
  edit(doc);
  fs.writeFileSync(file(rel), YAML.stringify(doc));
};
type Setup = { id: string; promptSet?: string };
const config = () => import("./config");

describe("config.ts on a broken copy of config/", () => {
  it("the unbroken copy validates (control: the tests below read the copy, not the repo)", async () => {
    const { validateAll } = await config();
    expect(validateAll()).toEqual([]);
  });

  it("a malformed frozen week names the file", async () => {
    fs.writeFileSync(file("evalsets/weeks/2026-11-02_2026-11-06.json"), "[{ not json");
    const { frozenWeek } = await config();
    expect(() => frozenWeek("2026-11-02", "2026-11-06")).toThrow(
      /^Config error in config\/evalsets\/weeks\/2026-11-02_2026-11-06\.json: /,
    );
  });

  it("a missing config file names the file, not a bare ENOENT", async () => {
    fs.rmSync(file("pipeline.yaml"));
    const { pipelineCfg } = await config();
    expect(() => pipelineCfg()).toThrow(/^Config error in config\/pipeline\.yaml: /);
  });

  it("a company whose id doesn't match its file name is rejected", async () => {
    editYaml("companies/hearth.yaml", (c) => {
      c.id = "hearth-renamed";
    });
    const { companies } = await config();
    expect(() => companies()).toThrow('config/companies/hearth.yaml: id "hearth-renamed" must match the file name');
  });

  it("a company with an unknown use value fails the schema, naming the file and field", async () => {
    editYaml("companies/brightside.yaml", (c) => {
      c.use = "maybe";
    });
    const { companies } = await config();
    expect(() => companies()).toThrow(/^Config error in config\/companies\/brightside\.yaml: use: /);
  });

  it("validateAll reports a duplicate setup id", async () => {
    editYaml("setups.yaml", (s) => {
      const list = s.setups as Setup[];
      list.push({ ...list[0] });
    });
    const { validateAll } = await config();
    expect(validateAll()).toEqual(["setups.yaml: duplicate setup id"]);
  });

  it("validateAll reports a setup naming a prompt set that has no file", async () => {
    let id = "";
    editYaml("setups.yaml", (s) => {
      const first = (s.setups as Setup[])[0];
      id = first.id;
      first.promptSet = "no-such-set";
    });
    const { validateAll } = await config();
    expect(validateAll()).toEqual([`setup ${id}: prompt set "no-such-set" has no config/prompt-sets/no-such-set.yaml`]);
  });

  it("validateAll reports minAgree above the number of judges", async () => {
    let judges = 0;
    editYaml("judges.yaml", (j) => {
      judges = (j.judges as unknown[]).length;
      j.minAgree = judges + 1;
    });
    const { validateAll } = await config();
    expect(validateAll()).toEqual([`judges.minAgree (${judges + 1}) is more than the number of judges`]);
  });
});
