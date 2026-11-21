import { describe, expect, it } from "vitest";
import { promptSetNames, prompts, validateAll, withPromptSet } from "../src/lib/config";

describe("prompt sets (config/prompt-sets/<name>.yaml override config/prompts.yaml)", () => {
  it("default prompts outside any set; the set's overrides inside it, everything else inherited", async () => {
    const base = prompts();
    expect(promptSetNames()).toContain("strict");
    const inside = await withPromptSet("strict", async () => prompts());
    expect(inside.filterSystem).not.toBe(base.filterSystem);
    expect(inside.actionsSystem).toBe(base.actionsSystem);
    expect(prompts().filterSystem).toBe(base.filterSystem);
  });

  it("concurrent runs with different sets don't leak into each other", async () => {
    const [a, b] = await Promise.all([
      withPromptSet("strict", async () => {
        await new Promise((r) => setTimeout(r, 5));
        return prompts().filterSystem;
      }),
      withPromptSet(undefined, async () => prompts().filterSystem),
    ]);
    expect(a).not.toBe(b);
  });

  it("every setup's prompt set exists", () => {
    expect(validateAll()).toEqual([]);
  });
});
