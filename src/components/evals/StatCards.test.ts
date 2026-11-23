import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EvalTargets } from "@/lib/config/schemas";
import { result } from "@/lib/evals/__fixtures__/eval-index";
import { readYaml } from "@/lib/config/load";
import { EvalStorySchema } from "@/lib/evals/story-schema";
import { computeVerdict } from "@/lib/evals/verdict";
import { StatCards } from "./StatCards";

const TARGETS: EvalTargets = { recall: 0.9, precision: 0.8, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.9, beatsBaseline: true, nearMiss: 0.01 };
const story = readYaml("eval-story.yaml", EvalStorySchema);
const index = {
  live: result("live-setup", { recall: 0.895, precision: 0.85, datesRight: 1, costPerRunUsd: 0.2 }, { runs: 69 }),
  baseline: result("base", { recall: 0.6, precision: 0.7, datesRight: 0.8, costPerRunUsd: 0.5 }, { runs: 36 }),
};
const html = renderToStaticMarkup(createElement(StatCards, { verdict: computeVerdict(index, TARGETS), story, targets: TARGETS }));
const card = (label: string) => html.split("<li").find((c) => c.includes(label)) ?? "";

describe("StatCards (summary headline numbers)", () => {
  it("shows recall, precision, dates and cost: live big, the baseline beside it, each with its split and runs", () => {
    const recall = card(story.measures.recall);
    expect(recall).toContain(">89.5%<");
    expect(recall).toContain("60%");
    expect(recall).toContain("all weeks · 69 runs");
    expect(recall).toContain("36 runs");
    expect(card(story.measures.costPerRunUsd)).toContain("$0.200");
  });

  it("marks a near miss as near, not as met (recall 89.5% against a 90% target)", () => {
    expect(card(story.measures.recall)).toMatch(/within a point of the 90% target/);
    expect(card(story.measures.precision)).toMatch(/meets the 80% target/);
  });

  it("has no target line for cost", () => {
    expect(card(story.measures.costPerRunUsd)).not.toMatch(/target/);
  });
});
