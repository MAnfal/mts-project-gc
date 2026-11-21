// Cheap compatibility check for the arena models: structured output, and web search + structured output
// (the baseline's combination). Tiny prompts; prints cost per call.
import { generateText, Output } from "ai";
import { z } from "zod";
import { gw, gatewayCost } from "../src/lib/gateway";
import { arenaModels, searchTools } from "../src/lib/models";

const schema = z.object({ document_number: z.string().nullable(), url: z.string().nullable() });
const only = process.argv[2];

for (const m of arenaModels().filter((x) => !only || x.id === only)) {
  for (const withSearch of [false, true]) {
    const t0 = Date.now();
    try {
      const r = await generateText({
        model: gw(m.id),
        tools: withSearch ? searchTools(m.id) : undefined,
        output: Output.object({ schema }),
        prompt: withSearch
          ? "Search the web: find the Federal Register document (federalregister.gov) published November 2026 in which FDA revokes the color additive listing for Orange B. Return its document number and URL."
          : "Return document_number '2026-00001' and url null.",
      });
      const cost = r.steps.reduce((a, s) => a + gatewayCost(s.providerMetadata), 0);
      const tools = r.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName));
      console.log(`${m.id} search=${withSearch} OK ${((Date.now() - t0) / 1000).toFixed(1)}s $${cost.toFixed(4)} tools=[${tools}] ->`, JSON.stringify(r.output));
    } catch (e) {
      console.log(`${m.id} search=${withSearch} ERROR ${(e as Error).message.slice(0, 300)}`);
    }
  }
}
