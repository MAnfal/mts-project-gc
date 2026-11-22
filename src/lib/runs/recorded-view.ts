// The one mapping from a recorded POC run (SCHEMA.md `RunRecord`: a suite run or an example run) to what a report
// shows: items with their tiers, owners and dates, held-back items, steps, and the failure. Pure and browser-safe
// (zod only), so the reviewer's report page uses it in the browser and scripts/build-examples.mts uses it, through
// src/lib/pipeline/recorded.ts, to project example runs for the GC. Values are copied, never recomputed: a tier
// here is the tier code assigned when the run was recorded.
//
// The view keeps internal names (stage ids, setup, model): it is reviewer-facing. Only recorded.ts turns it into
// public events.
import { z } from "zod";
import type { DocNote } from "../pipeline/events";
import type { ActionItem } from "../types";

const DeadlineSchema = z.looseObject({ date: z.string(), kind: z.enum(["comment", "effective", "compliance", "other"]), verified: z.boolean() });
const OwnerSchema = z.object({ name: z.string(), email: z.string() });

/** What the report reads of an item; everything else on it passes through untouched. */
const ItemSchema = z.looseObject({
  document_number: z.string(),
  title: z.string(),
  tier: z.enum(["Critical", "High", "Medium", "Low"]),
  deadline: DeadlineSchema.nullable(),
  owner: OwnerSchema,
  url: z.string(),
  citationVerified: z.boolean(),
});

const StageSchema = z.looseObject({
  name: z.string(),
  ms: z.number(),
  inCount: z.number().optional(),
  outCount: z.number().optional(),
  note: z.string().optional(),
});

const RecordSchema = z.looseObject({
  id: z.string(),
  createdAt: z.string(),
  status: z.enum(["done", "error"]),
  config: z.looseObject({
    profileId: z.string(),
    windowStart: z.string(),
    windowEnd: z.string(),
    asOf: z.string(),
    cell: z.string().optional(),
    model: z.string().optional(),
    customProfile: z.looseObject({ name: z.string() }).optional(),
  }),
  stages: z.array(StageSchema),
  totalMs: z.number(),
  scanned: z.number().optional(),
  items: z.array(ItemSchema).optional(),
  /** Relevant documents that failed verification, with the reason in the GC's words (the pipeline's `why`). */
  dropped: z.array(z.object({ document_number: z.string(), why: z.string() })).optional(),
  markdown: z.string().optional(),
  error: z.string().optional(),
});

export interface RecordedStage {
  /** The internal stage id (scan:federal-register, …). */
  name: string;
  ms: number;
  inCount: number | null;
  outCount: number | null;
  note: string | null;
}

export interface RecordedView {
  id: string;
  createdAt: string;
  status: "done" | "error";
  profileId: string;
  company: string;
  windowStart: string;
  windowEnd: string;
  asOf: string;
  /** The setup id the run used, and its model id (internal names). */
  setup: string | null;
  model: string | null;
  /** As recorded, in the run's own order. */
  items: ActionItem[];
  dropped: DocNote[];
  stages: RecordedStage[];
  /** Documents scanned; null for runs that recorded none (the single-prompt baseline). */
  scanned: number | null;
  totalMs: number;
  markdown: string;
  /** The recorded failure, for status error. */
  error: string | null;
}

export interface RecordedViewOptions {
  /** profileId → company name; a custom profile's own name always wins. */
  companyNames?: Record<string, string>;
  /** A document's title from the frozen week, for held-back items (which record only the number). */
  titleOf?: (documentNumber: string) => string | undefined;
}

/** Throws `Recorded run <id>: <field>: <problem>` for a record that isn't a finished or failed run. */
export function recordedView(raw: unknown, opts: RecordedViewOptions = {}): RecordedView {
  const parsed = RecordSchema.safeParse(raw);
  if (!parsed.success) {
    const id = raw && typeof raw === "object" && typeof (raw as { id?: unknown }).id === "string" ? (raw as { id: string }).id : "?";
    const issue = parsed.error.issues[0];
    throw new Error(`Recorded run ${id}: ${issue.path.join(".")}: ${issue.message}`);
  }
  const r = parsed.data;
  const c = r.config;
  return {
    id: r.id,
    createdAt: r.createdAt,
    status: r.status,
    profileId: c.profileId,
    company: c.customProfile?.name ?? opts.companyNames?.[c.profileId] ?? c.profileId,
    windowStart: c.windowStart,
    windowEnd: c.windowEnd,
    asOf: c.asOf,
    setup: c.cell ?? null,
    model: c.model ?? null,
    items: (r.items ?? []) as unknown as ActionItem[],
    dropped: (r.dropped ?? []).map((d) => ({ document_number: d.document_number, title: opts.titleOf?.(d.document_number) ?? d.document_number, reason: d.why })),
    stages: r.stages.map((s) => ({ name: s.name, ms: s.ms, inCount: s.inCount ?? null, outCount: s.outCount ?? null, note: s.note ?? null })),
    scanned: r.scanned ?? null,
    totalMs: r.totalMs,
    markdown: r.markdown ?? "",
    error: r.error ?? null,
  };
}
