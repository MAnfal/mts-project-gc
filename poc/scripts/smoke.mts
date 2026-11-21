import { generateText, Output, experimental_decide as decide } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { gw, gatewayCost } from "../src/lib/gateway";

const which = process.argv[2] ?? "all";

async function jev() {
  const r = await decide({
    model: gw.decisionModel("typesafe-ai/jev"),
    state: "Company: US payments fintech offering P2P transfers and a crypto wallet.\n\nDocument: FinCEN proposed rule lowering the threshold for the requirement to collect, retain, and transmit information on funds transfers (Travel Rule).",
    questions: {
      relevant: { type: "boolean", instructions: "Does this federal document plausibly create a compliance obligation or material risk for the company?" },
    },
  });
  console.log("JEV", JSON.stringify(r.answers), JSON.stringify(r.usage), JSON.stringify((r as any).providerMetadata ?? (r as any).response ?? {}).slice(0, 400));
}

async function structured() {
  const r = await generateText({
    model: gw("anthropic/claude-haiku-5.5"),
    output: Output.object({ schema: z.object({ relevant: z.boolean(), reason: z.string() }) }),
    prompt: "Is a FinCEN Travel Rule threshold change relevant to a P2P payments fintech? One-line reason.",
  });
  console.log("STRUCT", JSON.stringify(r.output), JSON.stringify(r.usage), "cost", gatewayCost(r.providerMetadata), JSON.stringify(r.providerMetadata).slice(0, 300));
}

async function exa() {
  const r = await generateText({
    model: gw("anthropic/claude-haiku-5.5"),
    tools: { exa_search: gw.tools.exaSearch({ numResults: 3, includeDomains: ["federalregister.gov"] }) },
    prompt: "Find the Federal Register document on FinCEN funds transfer recordkeeping threshold published November 2026. List URLs.",
  });
  const results = r.steps.flatMap((s) => s.toolResults);
  console.log("EXA text", r.text.slice(0, 300));
  console.log("EXA results", JSON.stringify(results).slice(0, 800), "cost", gatewayCost(r.providerMetadata));
}

async function native() {
  const r = await generateText({
    model: gw("anthropic/claude-haiku-5.5"),
    tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 2, allowedDomains: ["federalregister.gov"] }) },
    prompt: "Find the Federal Register document on FinCEN funds transfer recordkeeping threshold published November 2026. Give its document number and URL.",
  });
  console.log("NATIVE text", r.text.slice(0, 400));
  console.log("NATIVE sources", JSON.stringify(r.sources).slice(0, 600), "cost", gatewayCost(r.providerMetadata));
}

const fns: Record<string, () => Promise<void>> = { jev, structured, exa, native };
for (const [k, f] of Object.entries(fns)) {
  if (which !== "all" && which !== k) continue;
  try { await f(); } catch (e) { console.log(k.toUpperCase(), "ERROR", (e as Error).message.slice(0, 500)); }
}
