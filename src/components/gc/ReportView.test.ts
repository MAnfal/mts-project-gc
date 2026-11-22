import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { reduceEvents } from "@/lib/runs/reduce";
import { sortItems } from "@/lib/runs/report";
import type { ExampleRun } from "@/lib/runs/types";
import { ReportView } from "./ReportView";

// ReportView rendered to HTML from real generated examples (public/examples): the reviewer's run report passes
// `readOnly`, which must drop the GC's actions (draft emails, the memo download) and keep the report itself.
const example = (suffix: string) => {
  const dir = path.resolve(import.meta.dirname, "../../../public/examples");
  const file = fs.readdirSync(dir).find((f) => f.endsWith(`${suffix}.json`))!;
  return JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as ExampleRun;
};
const render = (ex: ExampleRun, readOnly?: boolean) => {
  const view = reduceEvents(ex.events);
  return renderToStaticMarkup(createElement(ReportView, { view, items: sortItems(view.items), company: ex.company, trace: null, readOnly }));
};

describe("ReportView readOnly", () => {
  it("shows the GC's draft-email links by default, and none when read-only", () => {
    const ex = example("t6m4");
    expect(render(ex)).toContain("Draft email to Marcus");
    const html = render(ex, true);
    expect(html).not.toContain("Draft email");
    expect(html).not.toContain("mailto:");
    // The report itself is all still there.
    expect(html).toContain("Continuation of the National Emergency With Respect to Iran");
    expect(html).toContain("not relevant");
  });

  it("drops the no-action memo download from the nothing-applies state, keeping the closest calls", () => {
    const ex = example("l14a");
    expect(render(ex)).toContain("no action&quot; memo");
    const html = render(ex, true);
    expect(html).not.toContain("memo");
    expect(html).toContain("Closest calls");
  });
});
