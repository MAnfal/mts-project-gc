import { createGateway } from "@ai-sdk/gateway";
import { config } from "dotenv";
import path from "node:path";

// The key lives in the repo-root .env (not poc/.env.local), so load it explicitly.
config({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
config({ path: path.resolve(process.cwd(), ".env"), quiet: true });

const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY ?? process.env.AI_GATEWAY_API_KEY;
if (!apiKey) throw new Error("Missing VERCEL_AI_GATEWAY_API_KEY in ../.env");

export const gw = createGateway({ apiKey });

/** Pull the USD cost the gateway reports for a call, if any. */
export function gatewayCost(providerMetadata: unknown): number {
  const g = (providerMetadata as { gateway?: { cost?: string | number } } | undefined)?.gateway;
  const c = Number(g?.cost ?? 0);
  return Number.isFinite(c) ? c : 0;
}
