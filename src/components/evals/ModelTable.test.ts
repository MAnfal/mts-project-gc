import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { readYaml } from "@/lib/config/load";
import { result } from "@/lib/evals/__fixtures__/eval-index";
import type { ModelGroup } from "@/lib/evals/models";
import { EvalStorySchema } from "@/lib/evals/story-schema";
import { ModelTable } from "./ModelTable";

// One rendered table: a measure with no value shows the dash, never "0%" or "NaN%" (the real story supplies the headers).
const story = readYaml("eval-story.yaml", EvalStorySchema);
const row = (setup: string, judgePass: number | null) => ({
  setup,
  label: setup,
  model: `vendor/${setup}`,
  modelLabel: setup,
  method: "jev+llm",
  promptSet: null,
  live: setup === "a",
  result: result(setup, { recall: 0.9, judgePass }, { suite: ["su1"], runs: 18 }),
});
const group: ModelGroup = { suite: "su1", weeks: [], runs: 36, evalsets: 6, models: ["a", "b"], rows: [row("a", 0.75), row("b", null)] };
const html = renderToStaticMarkup(createElement(TooltipProvider, null, createElement(ModelTable, { group, story })));
const rowHtml = (setup: string) => html.split("<tr").find((r) => r.includes(`>${setup}</a>`)) ?? "";

describe("ModelTable", () => {
  it("renders a null measure as a dash and a present one as its value", () => {
    expect(rowHtml("b")).toContain(">—<");
    expect(rowHtml("b")).not.toMatch(/NaN|null/);
    expect(rowHtml("a")).toContain(">75%<");
    expect(rowHtml("a")).not.toContain(">—<");
  });

  it("links each setup to its cases in this suite", () => {
    expect(html).toContain('href="/evals/cases?suite=su1&amp;setup=b"');
  });
});
