// Shared shapes for the POC. Everything a run produces is persisted as JSON under data/.

export type DocType = "Rule" | "Proposed Rule" | "Notice" | "Presidential Document";

/** One Federal Register document, as returned by the documents API (subset of fields). */
export interface FrDoc {
  document_number: string;
  type: DocType;
  title: string;
  abstract: string | null;
  agencies: { name?: string; slug?: string; raw_name?: string }[];
  publication_date: string;
  effective_on: string | null;
  comments_close_on: string | null;
  /** Free-text DATES section, e.g. "Comments must be received on or before ..." */
  dates: string | null;
  citation: string | null;
  cfr_references: { title: number; part: string | null }[];
  html_url: string;
  raw_text_url?: string;
  action?: string | null;
}

export interface Owner {
  name: string;
  email: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  summary: string;
  /** What the company does — the relevance anchor. */
  businessLines: string[];
  /** Explicitly in scope / out of scope, as the GC would write it. */
  applies: string[];
  doesNotApply: string[];
  /** Affected-area taxonomy; each area maps to exactly one owner (deterministic routing). */
  areas: Record<string, { description: string; owner: Owner }>;
  /** Fallback owner for Critical items with no area match. */
  generalCounsel: Owner;
}

export type Tier = "Critical" | "High" | "Medium" | "Low";

export type DeadlineKind = "comment" | "effective" | "compliance" | "other";

export interface Deadline {
  date: string; // YYYY-MM-DD
  kind: DeadlineKind;
  /** Where the date came from. Structured API fields are trusted; extracted ones need a quote. */
  source: "fr_field" | "extracted";
  /** For extracted dates: the verbatim span from the primary source. */
  quote?: string;
  verified: boolean;
  verifyNote?: string;
}

export interface FilterDecision {
  document_number: string;
  jevProbability?: number;
  llm?: { relevant: boolean; reason: string; areas: string[] };
  relevant: boolean;
}

export interface ActionItem {
  document_number: string;
  title: string;
  type: DocType;
  agencies: string[];
  tier: Tier;
  tierReason: string;
  deadline: Deadline | null;
  /** All dates we checked, kept for the UI. */
  deadlines: Deadline[];
  owner: Owner;
  areas: string[];
  reason: string;
  action: string;
  citation: string | null;
  citationVerified: boolean;
  url: string;
  sourceTag: "[Federal Register]" | "[web search — verify]";
}

export interface LlmCallLog {
  stage: string;
  model: string;
  ms: number;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  prompt?: string;
  output?: unknown;
  toolCalls?: { name: string; input: unknown; output?: unknown }[];
  error?: string;
}

export interface StageLog {
  name: string;
  ms: number;
  costUsd: number;
  inCount?: number;
  outCount?: number;
  note?: string;
}

export interface RunConfig {
  mode: "pipeline" | "baseline";
  profileId: string;
  windowStart: string; // YYYY-MM-DD inclusive
  windowEnd: string; // YYYY-MM-DD inclusive
  asOf: string; // YYYY-MM-DD — tiering clock, never wall-clock
  model: string; // gateway id, e.g. anthropic/claude-sonnet-5.5
  filter: "jev+llm" | "llm" | "jev";
  jevThreshold: number;
  webLeads: boolean;
  /** Free label to group repeated runs for consistency scoring. */
  group?: string;
  /** Arena this run belongs to, and its cell (config) key inside the arena. */
  arena?: string;
  cell?: string;
}

export interface RunRecord {
  id: string;
  createdAt: string;
  config: RunConfig;
  /** Hash of config/*.yaml when the run started (prompts, setups, pipeline knobs). Runs with different hashes aren't like-for-like. */
  configHash?: string;
  status: "running" | "done" | "error";
  error?: string;
  stages: StageLog[];
  calls: LlmCallLog[];
  scanned?: number;
  decisions?: FilterDecision[];
  webLeads?: { url: string; document_number: string | null; inWindow: boolean }[];
  items?: ActionItem[];
  dropped?: { document_number: string; why: string }[];
  /** Baseline only: raw items as the model claimed them, before resolution. */
  claimed?: unknown[];
  markdown?: string;
  /** LLM-judge clarity score for the action items, run once after the run finishes. */
  judge?: { model: string; clarity: number | null; perItem: { document_number: string; score: number; why: string }[]; costUsd: number; error?: string };
  totalCostUsd: number;
  totalMs: number;
}

export interface LabelSet {
  profileId: string;
  windowStart: string;
  windowEnd: string;
  relevant: string[];
  /** Agencies whose docs were all looked at — the honest recall denominator. */
  reviewedAgencies: string[];
  notes: Record<string, string>;
  updatedAt: string;
  /** Who/what produced the key (e.g. a blind Claude Code subagent). */
  provenance?: string;
  /** Per relevant doc: expected owner area, plain reason, confidence, and the expected deadline from the source. */
  details?: Record<string, KeyDetail>;
  borderlineRejected?: Record<string, { reason: string; confidence: string }>;
}

export interface KeyDetail {
  relevant: true;
  area: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  deadline: { date: string; kind: DeadlineKind; quote: string } | null;
}
