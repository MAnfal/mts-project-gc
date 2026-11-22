import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { judges } from "@/lib/config";
import { readYaml } from "@/lib/config/load";
import { EvalAppConfigSchema } from "@/lib/config/schemas";
import { EvalIndexSchema } from "./index-schema";
import { IterationRecordSchema } from "./loader";
import { EvalStorySchema, Prose } from "./story-schema";
import { fillTemplate, modelsStory, resolveQuote, storyContext, verdictHeading } from "./story";
import { computeVerdict } from "./verdict";

// The real config files and the real shipped bundle: what the eval pages render.
const BUNDLE = path.resolve(import.meta.dirname, "../../../public/evals");
const readJson = (rel: string) => JSON.parse(fs.readFileSync(path.join(BUNDLE, rel), "utf8"));
const story = () => readYaml("eval-story.yaml", EvalStorySchema);
const targets = () => readYaml("app.yaml", EvalAppConfigSchema).evalTargets;
const shippedIndex = () => EvalIndexSchema.parse(readJson("index.json"));

describe("config/app.yaml → evalTargets", () => {
  it("parses to the RFC targets", () => {
    expect(targets()).toEqual({ recall: 0.9, precision: 0.8, datesRight: 1, tierAgreement: 1, relevanceAgreement: 0.9, beatsBaseline: true, nearMiss: 0.01 });
  });

  it("rejects a target outside 0–1 and an unknown measure", () => {
    const t = { ...targets() };
    expect(EvalAppConfigSchema.safeParse({ evalTargets: { ...t, recall: 90 } }).success).toBe(false);
    expect(EvalAppConfigSchema.safeParse({ evalTargets: { ...t, f1: 0.9 } }).success).toBe(false);
  });
});

describe("config/eval-story.yaml", () => {
  it("has a story entry for exactly the iterations the bundle ships, with their outcomes", () => {
    const s = story();
    expect(Object.keys(s.iterations).sort()).toEqual(shippedIndex().iterations.map((i) => i.id).sort());
    expect(s.iterations["00-baseline"].outcome).toBe("reference");
    expect(s.iterations["06-passages"].outcome).toBe("promoted");
    expect(s.iterations["07-next"].outcome).toBe("next");
  });

  it("reconciles iteration 06's computed noise verdict with the band its recorded decision used", () => {
    const s = story();
    expect(s.iterations["06-passages"].noiseNote).toMatch(/four of its identical-config suites/);
    const record = IterationRecordSchema.parse(readJson("iterations/06-passages/iteration.json"));
    expect(record.decision).toContain("across its four identical-config suites");
  });

  it("rejects a typed number in a noise note", () => {
    const s = structuredClone(story());
    s.iterations["06-passages"].noiseNote = "Band was 4.4 across suites.";
    expect(EvalStorySchema.safeParse(s).success).toBe(false);
  });

  it("fills every template from the shipped index, and the computed heading reads off the data", () => {
    const s = story();
    const idx = shippedIndex();
    const verdict = computeVerdict(idx, targets());
    const ctx = storyContext(idx, verdict, s);
    for (const row of Object.values(s.carl)) expect(fillTemplate(row.text, ctx)).not.toContain("{{");
    expect(fillTemplate(s.verdict.sub, ctx)).not.toContain("{{");
    // The shipped data: recall 0.898 misses its 0.9 target; every other target is met; the baseline is beaten everywhere.
    expect(verdictHeading(s, ctx, verdict)).toBe("Beats a single-prompt baseline on every measure, and meets 5 of 6 targets");
  });

  it("resolves every moved item's quote verbatim from the shipped iteration.json", () => {
    const s = story();
    let quotes = 0;
    for (const [id, it] of Object.entries(s.iterations)) {
      const record = IterationRecordSchema.parse(readJson(`iterations/${id}/iteration.json`));
      for (const m of it.moved)
        if (m.quote) {
          const q = resolveQuote(record, m.quote);
          expect(record[m.quote.from]).toContain(q);
          quotes++;
        }
    }
    expect(quotes).toBeGreaterThan(0);
  });
});

describe("config/eval-story.yaml → models, filled from the shipped index and config/judges.yaml", () => {
  const panel = () => {
    const j = judges();
    return { models: j.judges.map((x) => x.model), minAgree: j.minAgree };
  };
  const view = () => modelsStory(shippedIndex(), panel(), story());

  it("states why the live model, as computed comparisons of the like-for-like pair in w0i, each with its runs", () => {
    const v = view();
    expect(v.heading).toBe("Why Sonnet 5.5");
    expect(v.intro).toBe(
      "In suite w0i, two setups differ only in the model: jev-sonnet on Sonnet 5.5 and jev-gpt on GPT-6.2 Sol, both the jev+llm method with the default prompt, over all of the suite's weeks.",
    );
    expect(v.points).toEqual([
      "Found what matters (recall): 97.6% vs 85.7%, 11.9 pts higher on Sonnet 5.5 (18 runs each).",
      "Flags that were right (precision): 48.8% vs 50.7%, 1.9 pts lower on Sonnet 5.5 (18 runs each).",
      "Cost per run: $0.159 vs $0.103, $0.056 higher on Sonnet 5.5 (18 runs each).",
    ]);
  });

  it("words the key-bias caveat over the pipeline setups only (the baseline's recall is lower still)", () => {
    expect(view().caveats[0]).toBe(
      "Possible key bias. The answer keys were drafted by Claude models. Among the 4 pipeline setups in suite w0i, the lowest recall is jev-gpt (85.7%, 18 runs), the only one on a non-Claude model. The single-prompt baseline is not a pipeline and is left out of this ranking; its recall is in the table.",
    );
  });

  it("words price parity as the arena config's list price per token, with no date, and the tuning caveat from the setups", () => {
    expect(view().caveats[1]).toBe(
      "Price parity. The models were chosen at the same AI Gateway list price per token, per the arena config used for suite w0i. The same price per token is not the same cost per run: the table shows each setup's measured cost.",
    );
    expect(view().caveats[2]).toBe("Tuned on one model. The live setup's strict prompt ran only on Sonnet 5.5; GPT-6.2 Sol ran only with the default prompt.");
  });

  it("states the judge rule from judges.yaml and the live-row rule", () => {
    const v = view();
    expect(v.judges).toContain("A verdict needs 2 of the 3 judges to agree");
    expect(v.liveRule).toBe(
      "Highlighted rows run the live model, Sonnet 5.5. The live setup itself (jev-sonnet-strict-passages) came later and never ran beside another model, so these rows are earlier setups on each model.",
    );
  });

  it("rejects a typed number in the models prose", () => {
    const s = structuredClone(story());
    s.models.why.points[0] = "Recall 97.6% vs {{models.recall.other}}";
    expect(EvalStorySchema.safeParse(s).success).toBe(false);
  });
});

describe("EvalStorySchema guards (no typed numbers)", () => {
  it("rejects prose with a digit outside a placeholder, and accepts digits inside one", () => {
    expect(Prose.safeParse("Recall 89.8% → {{live.recall.all}}").success).toBe(false);
    expect(Prose.safeParse("Costs $0.52 a run").success).toBe(false);
    expect(Prose.safeParse("Recall {{baseline.recall.all}} → {{live.recall.all}}").success).toBe(true);
  });

  it("rejects a typed number in a moved item's text or quote anchor", () => {
    const s = structuredClone(story());
    s.iterations["06-passages"].moved[0].text = "Found in 9 of 9 runs";
    expect(EvalStorySchema.safeParse(s).success).toBe(false);
    const t = structuredClone(story());
    t.iterations["06-passages"].moved[0].quote = { from: "decision", start: "flagged 0/6" };
    expect(EvalStorySchema.safeParse(t).success).toBe(false);
  });

  it("rejects an unknown outcome and a missing measure label", () => {
    const s = structuredClone(story()) as unknown as { iterations: Record<string, { outcome: string }>; measures: Record<string, string> };
    s.iterations["03-strict-v2"].outcome = "dropped";
    expect(EvalStorySchema.safeParse(s).success).toBe(false);
    const t = structuredClone(story()) as unknown as { measures: Record<string, string> };
    delete t.measures.tierAgreement;
    expect(EvalStorySchema.safeParse(t).success).toBe(false);
  });
});
