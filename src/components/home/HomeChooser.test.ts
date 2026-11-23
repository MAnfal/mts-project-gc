import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EvalSidebar } from "@/components/evals/EvalSidebar";
import type { EvalStory } from "@/lib/evals/story-schema";
import { HomeChooser } from "./HomeChooser";

const hrefs = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

describe("HomeChooser (/)", () => {
  it("offers the two screens: a new run and the eval results", () => {
    const html = renderToStaticMarkup(createElement(HomeChooser, { appName: "Reg Monitor" }));
    expect(html).toContain("Reg Monitor");
    expect(hrefs(html)).toEqual(expect.arrayContaining(["/runs/new", "/evals"]));
  });
});

describe("EvalSidebar wordmark", () => {
  it("takes the reviewer back to / (the chooser), not the eval summary", () => {
    const story = { iterations: { "00": { label: "baseline", outcome: "reference" } } } as unknown as EvalStory;
    const html = renderToStaticMarkup(createElement(EvalSidebar, { appName: "Reg Monitor", story, active: "summary" }));
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>Reg Monitor<\/a>/);
  });
});
