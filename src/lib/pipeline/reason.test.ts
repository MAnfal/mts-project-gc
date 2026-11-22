import { afterEach, describe, expect, it, vi } from "vitest";
import { itemReason, NEUTRAL_REASON } from "./stages";
import { runPipeline } from "./run";
import type { RunEvent } from "./events";
import { installModels, restoreModels, synConfig, synDoc, synFetch } from "./__fixtures__/harness";

afterEach(() => {
  vi.unstubAllGlobals();
  restoreModels();
});

describe("an item's reason when the LLM gave none", () => {
  it("is the neutral fallback, never the internal probability", () => {
    expect(NEUTRAL_REASON).toBe("Flagged as relevant to your profile");
    expect(itemReason({ document_number: "2026-90001", relevant: true, llm: undefined, jevProbability: 0.42 })).toBe("Flagged as relevant to your profile");
  });

  it("is the LLM's reason whenever there is one", () => {
    const llm = { relevant: true, reason: "Changes card-fee disclosures.", areas: ["payments"] };
    expect(itemReason({ document_number: "2026-90001", relevant: true, llm, jevProbability: 0.42 })).toBe("Changes card-fee disclosures.");
  });

  it("is empty when there was neither an LLM verdict nor a relevance score (as in the POC)", () => {
    expect(itemReason({ document_number: "2026-90001", relevant: true })).toBe("");
    expect(itemReason(undefined)).toBe("");
  });

  it("reaches the item and every event of a run whose filter is relevance-only (no LLM verdicts at all)", async () => {
    vi.stubGlobal("fetch", synFetch([synDoc("2026-90001")], () => "Effective January 15, 2027."));
    installModels({ llm: ({ kind }) => (kind === "extract" ? { deadlines: [] } : { actions: [] }), jev: () => 0.42 });
    const events: RunEvent[] = [];
    const out = await runPipeline(synConfig({ filter: "jev", filterExcerpts: undefined }), (e) => events.push(e));
    expect(out.items.map((i) => i.reason)).toEqual(["Flagged as relevant to your profile"]);
    expect(JSON.stringify(events)).not.toContain("0.42");
    expect(JSON.stringify(events)).not.toMatch(/p=/);
  });
});
