import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readYaml } from "@/lib/config/load";
import { liveSetupContext, liveSetupView } from "@/lib/evals/liveSetup";
import { EvalStorySchema } from "@/lib/evals/story-schema";
import { LiveSetupView } from "./LiveSetupView";

const story = readYaml("eval-story.yaml", EvalStorySchema);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

describe("LiveSetupView (/evals/setup)", async () => {
  const view = await liveSetupView();
  const html = renderToStaticMarkup(createElement(LiveSetupView, { view, story, ctx: liveSetupContext(view) }));
  const strict = YAML.parse(fs.readFileSync(path.join(process.cwd(), "config", `prompt-sets/${view.promptSet}.yaml`), "utf8"));

  it("states the setup, model and passages settings from the live config", () => {
    expect(html).toContain(esc(view.setup.label));
    expect(html).toContain(esc(view.model.label));
    expect(html).toContain(`best ${view.filterExcerpts!.perDoc} passages`);
  });

  it("shows every stage's prompts in full, by name", () => {
    for (const s of Object.values(story.liveSetup.stages)) expect(html).toContain(esc(s.title));
    for (const p of view.stages.flatMap((s) => s.prompts)) expect(html).toContain(p.name);
  });

  it("shows the overridden prompt side by side with its default, marking the live-only lines as added", () => {
    const added = strict.filterSystem.split("\n").find((l: string) => l.startsWith("Mark NOT relevant"));
    expect(html).toContain(esc(story.liveSetup.defaultPane));
    const cells = html.split("<td").filter((c) => c.includes(esc(added)));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c.startsWith(' data-kind="added"'))).toBe(true);
    // The shared tail (the areas block) is unchanged on both sides.
    expect(html.split("<td").filter((c) => c.includes("Affected areas:")).every((c) => c.startsWith(' data-kind="same"'))).toBe(true);
  });
});
