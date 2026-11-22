import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunEvent } from "@/lib/pipeline/events";
import type { ExampleRun, RunStatus, StoredRun } from "@/lib/runs/types";

// Where the follow-up chat mounts (amendment 1): under the Report of a finished live run and of an example, and nowhere
// else. Rendered to HTML in node like ReportView.test.ts; the page's runner (./useRun) is replaced by a fixed run, so
// each status renders without IndexedDB. The chat's own effects (loading saved turns) don't run in a static render.

const state: { run: StoredRun | null } = { run: null };
vi.mock("./useRun", () => ({
  useRun: () => ({ run: state.run, persistent: true, retry: async () => null, confirm: async () => {} }),
  useRecentRuns: () => ({ runs: [], persistent: true }),
  getRunner: () => new Promise(() => {}),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const { RunView } = await import("./RunView");
const { ExampleReport } = await import("./ExampleView");

const dir = path.resolve(import.meta.dirname, "../../../public/examples");
const ex = JSON.parse(fs.readFileSync(path.join(dir, fs.readdirSync(dir).find((f) => f.endsWith("t6m4.json"))!), "utf8")) as ExampleRun;
const doneIdx = ex.events.findIndex((e) => e.type === "run.done");
const failedEvents: RunEvent[] = [...ex.events.slice(0, doneIdx), { type: "run.failed", step: "write", message: "No response after 3 tries." }];
const SUGGESTIONS = ["Summarize for the CEO in 3 lines", "Did anything on crypto come close?"];

/** The chat's own marks: the composer's label and the chips. */
const hasChat = (html: string) => {
  const composer = html.includes("Ask about this report");
  const chips = SUGGESTIONS.every((s) => html.includes(s));
  expect(composer).toBe(chips); // the composer and the chips come and go together
  return composer;
};

function storedRun(status: RunStatus): StoredRun {
  const events = status === "done" ? ex.events : status === "failed" ? failedEvents : ex.events.slice(0, doneIdx);
  const result = status === "done" ? (ex.events[doneIdx] as StoredRun["result"]) : null;
  return { id: "r1", createdAt: "2026-11-23T10:00:00.000Z", request: { profileId: "ledgerly", windowStart: ex.windowStart, windowEnd: ex.windowEnd }, events, status, result, profile: ex.profile };
}
const renderRun = () => renderToStaticMarkup(createElement(RunView, { id: "r1", appName: "Reg Monitor", user: null, suggestions: SUGGESTIONS }));

describe("RunView mounts the follow-up chat only under a finished report", () => {
  beforeEach(() => {
    state.run = null;
  });

  it("shows the chips and the composer under a finished run's report", () => {
    state.run = storedRun("done");
    const html = renderRun();
    expect(html).toContain("Continuation of the National Emergency With Respect to Iran"); // the report itself
    expect(hasChat(html)).toBe(true);
  });

  for (const status of ["running", "failed", "interrupted"] as const) {
    it(`renders no chat while the run is ${status}`, () => {
      state.run = storedRun(status);
      expect(hasChat(renderRun())).toBe(false);
    });
  }

  it("renders no chat while the run is loading, or when this browser has no such run", () => {
    expect(hasChat(renderRun())).toBe(false);
  });
});

describe("ExampleView mounts the follow-up chat under a finished example", () => {
  it("shows the chips and the composer under a recorded example's report", () => {
    const html = renderToStaticMarkup(createElement(ExampleReport, { example: ex, suggestions: SUGGESTIONS }));
    expect(html).toContain("Continuation of the National Emergency With Respect to Iran");
    expect(hasChat(html)).toBe(true);
  });

  it("renders no chat for an example whose events end in a failure", () => {
    expect(hasChat(renderToStaticMarkup(createElement(ExampleReport, { example: { ...ex, events: failedEvents }, suggestions: SUGGESTIONS })))).toBe(false);
  });
});

describe("FollowUpChat", () => {
  it("renders the chips and the composer as real buttons and a labelled textarea", async () => {
    const { FollowUpChat } = await import("./FollowUpChat");
    const html = renderToStaticMarkup(createElement(FollowUpChat, { chatId: "example:x", context: null as never, suggestions: SUGGESTIONS }));
    for (const s of SUGGESTIONS) expect(html).toMatch(new RegExp(`<button[^>]*type="button"[^>]*>${s}</button>`));
    expect(html).toMatch(/<label[^>]*for="([^"]+)"[^>]*>Ask about this report<\/label><textarea[^>]*id="\1"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*aria-label="Send"/);
    expect(html).toContain("Answers use this report and its sources only");
  });
});
