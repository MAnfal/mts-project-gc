import "server-only";
import { createGateway } from "@ai-sdk/gateway";

// Ported from poc:poc/src/lib/gateway.ts. The POC loaded VERCEL_AI_GATEWAY_API_KEY from ../.env with dotenv and
// threw at import when it was missing. Here the gateway reads AI_GATEWAY_API_KEY from the environment itself, and
// a missing key fails only when a model is resolved, so importing this module (a build, a test) never needs it.

let gw: ReturnType<typeof createGateway> | undefined;

function gateway() {
  if (!process.env.AI_GATEWAY_API_KEY) throw new Error("AI_GATEWAY_API_KEY is not set: add the AI Gateway key to the environment (.env.local, or the Vercel project settings).");
  return (gw ??= createGateway());
}

/** Pull the USD cost the gateway reports for a call, if any. */
export function gatewayCost(providerMetadata: unknown): number {
  const g = (providerMetadata as { gateway?: { cost?: string | number } } | undefined)?.gateway;
  const c = Number(g?.cost ?? 0);
  return Number.isFinite(c) ? c : 0;
}

// ── Model resolution (one seam, so tests can run the real pipeline with fake models at no cost) ──
type LM = ReturnType<ReturnType<typeof createGateway>>;
type DM = ReturnType<ReturnType<typeof createGateway>["decisionModel"]>;
const live = { language: (id: string): LM => gateway()(id), decision: (id: string): DM => gateway().decisionModel(id) };
let resolvers = live;
export const languageModel = (id: string) => resolvers.language(id);
export const decisionModel = (id: string) => resolvers.decision(id);
/** Tests only: swap in mock models (ai/test); null restores the gateway. */
export function setModelsForTests(r: { language: (id: string) => unknown; decision: (id: string) => unknown } | null) {
  resolvers = (r ?? live) as typeof resolvers;
}
