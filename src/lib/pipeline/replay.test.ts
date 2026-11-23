import { beforeAll, describe, expect, it } from "vitest";
import { body, omit, recordedMarkdown, runReplay, type ReplayResult, type TraceEvent } from "./__fixtures__/replay";

// Parity contract: the ported pipeline, fed the recorded model answers and source documents of one POC run of the
// live setup, makes exactly the decisions that run made and sends the models exactly what that run sent.

let r: ReplayResult;
beforeAll(async () => {
  r = await runReplay();
}, 60_000);

const ofType = (events: TraceEvent[], type: string) => events.filter((e) => e.type === type);
const byDoc = (events: TraceEvent[]) => [...events].sort((a, b) => String(a.document_number).localeCompare(String(b.document_number)));
const pick = (e: TraceEvent, keys: string[]) => Object.fromEntries(keys.map((k) => [k, e[k]]));

describe("replay of a recorded jev-sonnet-strict-passages run (zxuc: Brightside, 2026-11-02..06)", () => {
  it("makes no request the recorded run didn't make", () => {
    expect(r.unrecorded).toEqual([]);
  });

  it("finishes with run.done", () => {
    expect(r.events.at(-1)?.type).toBe("run.done");
  });

  it("decides every scanned document exactly as recorded (relevance cut, LLM verdict, final relevance)", () => {
    const want = ofType(r.recorded, "filter.decision");
    const got = ofType(r.trace, "filter.decision");
    expect(want).toHaveLength(466);
    expect(byDoc(got).map(body)).toEqual(byDoc(want).map(body));
  });

  it("sends every decision-model request the recorded run sent, byte-identical, once each", () => {
    const want = ofType(r.recorded, "jev.call").map((e) => pick(e, ["model", "state", "question"]));
    const got = r.calls.jev.map((c) => ({ model: c.model, state: c.state, question: c.question }));
    const key = (x: Record<string, unknown>) => `${x.state}`;
    expect(got.map(key).sort()).toEqual(want.map(key).sort());
    expect(new Set(got.map((c) => `${c.model}|${c.question}`))).toEqual(new Set(want.map((c) => `${c.model}|${c.question}`)));
  });

  it("picks the same passages for the top 20 documents", () => {
    const keys = ["document_number", "chunks", "picked"];
    expect(byDoc(ofType(r.trace, "filter.passages")).map((e) => pick(e, keys))).toEqual(byDoc(ofType(r.recorded, "filter.passages")).map((e) => pick(e, keys)));
  });

  it("sends every LLM request the recorded run sent (system + prompt byte-identical), once each", () => {
    const want = ofType(r.recorded, "llm.call").map((e) => `${e.model}\n${e.system}\n${e.prompt}`);
    const got = r.calls.llm.map((c) => `${c.model}\n${c.system}\n${c.prompt}`);
    expect(got.sort()).toEqual(want.sort());
  });

  it("verifies each relevant document's dates and citation as recorded", () => {
    // textSource names the cache that served the text (the POC's disk cache, here the in-memory one): not a decision.
    const strip = (e: TraceEvent) => omit(body(e), ["textSource"]);
    expect(byDoc(ofType(r.trace, "verify.doc")).map(strip)).toEqual(byDoc(ofType(r.recorded, "verify.doc")).map(strip));
  });

  it("assigns every tier and owner as recorded", () => {
    for (const type of ["tier.assign", "owner.assign", "action.write"]) {
      const want = ofType(r.recorded, type);
      expect(want.length, type).toBe(3);
      expect(byDoc(ofType(r.trace, type)).map(body), type).toEqual(byDoc(want).map(body));
    }
  });

  it("returns the recorded final items, dropped list and markdown report", () => {
    const end = ofType(r.recorded, "run.end")[0];
    expect(r.result.items).toEqual(end.itemsFinal);
    expect(r.result.items.map((i) => [i.document_number, i.deadline, i.citation])).toEqual(
      (end.itemsFinal as { document_number: string; deadline: unknown; citation: string }[]).map((i) => [i.document_number, i.deadline, i.citation]),
    );
    expect(r.result.dropped).toEqual(end.dropped);
    expect(r.result.markdown).toBe(recordedMarkdown());
  });

  it("run.done carries the report, the screened-out list in relevance order, and the not-reviewed count", () => {
    const done = r.events.at(-1);
    if (done?.type !== "run.done") throw new Error("no run.done");
    const decisions = ofType(r.recorded, "filter.decision");
    const sent = decisions.filter((d) => d.passedJev);
    const rejected = sent.filter((d) => d.llm && !(d.llm as { relevant: boolean }).relevant);
    expect(done.scanned).toBe(466);
    expect(done.items).toEqual(r.result.items);
    expect(done.markdown).toBe(recordedMarkdown());
    expect(done.dropped).toEqual([]);
    expect(done.notReviewedCount).toBe(466 - sent.length);
    expect(done.screenedOut.map((s) => s.document_number)).toEqual(
      [...rejected].sort((a, b) => (b.jevProbability as number) - (a.jevProbability as number)).map((d) => d.document_number),
    );
    const reasons = new Map(rejected.map((d) => [d.document_number, (d.llm as { reason: string }).reason]));
    for (const s of done.screenedOut) {
      expect(s.reason).toBe(reasons.get(s.document_number));
      expect(Object.keys(s).sort()).toEqual(["document_number", "reason", "title"]);
    }
  });

  it("emits item.confirmed once per verified item", () => {
    const confirmed = r.events.flatMap((e) => (e.type === "item.confirmed" ? [e.item.document_number] : []));
    expect(confirmed.sort()).toEqual(r.result.items.map((i) => i.document_number).sort());
  });
});
