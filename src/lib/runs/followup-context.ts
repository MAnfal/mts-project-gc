// The browser side of the follow-up chat under a finished report: the context sent with each question (a whitelist
// copy of what the Report screen shows), which runs get a chat, and one question's request, stream and save.
// Client-safe: types only from the pipeline, fetch and the store injected, so every branch is tested without a browser.
// The server (src/app/api/followup/followup.ts) validates this same shape and answers from it alone.
import type { CompanyProfile, DeadlineKind, Owner, Tier } from "../types";
import { readNdjson } from "./reader";
import type { RunViewState } from "./reduce";
import { sortItems } from "./report";
import type { RunStore } from "./store";
import type { ChatTurn } from "./types";

/** The route's line when an answer stops part-way, and ours when the stream ends without saying how. */
export const FOLLOWUP_FAILED = "The answer stopped before it finished. Ask the question again.";
/** The route's 503 sentence, and ours when the answer isn't one of the route's plain sentences (or never arrives). */
export const FOLLOWUP_UNAVAILABLE = "Answers aren't available right now. Try again in a minute.";
/** A blank question is never sent; the route refuses one with the same sentence. */
export const EMPTY_QUESTION = "Type a question first.";

export interface FollowUpDate {
  date: string;
  kind: DeadlineKind;
}

/** One action item as the report shows it. `source` is the number beside it in the report and the Sources panel. */
export interface FollowUpItem {
  source: number;
  document_number: string;
  title: string;
  type: string;
  agencies: string[];
  tier: Tier;
  tierReason: string;
  deadline: FollowUpDate | null;
  /** Every verified date the report shows for the item. */
  dates: FollowUpDate[];
  owner: Owner;
  areas: string[];
  reason: string;
  action: string;
  citation: string | null;
  url: string;
}

/** A document the report lists without an action: held back, or screened out. */
export interface FollowUpNote {
  document_number: string;
  title: string;
  reason: string;
}

/** A held-back item the GC added after checking it: never tiered (code computed no tier for it). */
export interface FollowUpChecked extends FollowUpNote {
  tier: "Not tiered";
  owner: Owner;
  url: string;
}

export interface FollowUpProfile {
  name: string;
  summary: string;
  businessLines: string[];
  applies: string[];
  doesNotApply: string[];
  areas: { name: string; description: string; owner: Owner }[];
  generalCounsel: Owner;
}

/** Everything a follow-up answer may use: this run's report, and nothing else. */
export interface FollowUpContext {
  company: string;
  windowStart: string;
  windowEnd: string;
  asOf: string | null;
  scanned: number;
  notReviewedCount: number;
  items: FollowUpItem[];
  checkedByYou: FollowUpChecked[];
  heldBack: FollowUpNote[];
  screenedOut: FollowUpNote[];
  profile: FollowUpProfile;
}

const owner = (o: Owner): Owner => ({ name: o.name, email: o.email });
const dated = (d: { date: string; kind: DeadlineKind }): FollowUpDate => ({ date: d.date, kind: d.kind });
const note = (n: FollowUpNote): FollowUpNote => ({ document_number: n.document_number, title: n.title, reason: n.reason });

/**
 * The report a follow-up question is asked about, copied field by field from the screen state (reduceEvents, then
 * applyConfirmed) and the profile the run used. Named fields only, never a spread: whatever else the view or an item
 * carries (verification quotes, internal scores) stays out. Items are in report order, numbered from 1.
 */
export function buildFollowUpContext(view: RunViewState, profile: CompanyProfile): FollowUpContext {
  return {
    company: view.company ?? profile.name,
    windowStart: view.windowStart ?? "",
    windowEnd: view.windowEnd ?? "",
    asOf: view.asOf,
    scanned: view.scanned,
    notReviewedCount: view.notReviewedCount,
    items: sortItems(view.items).map((i, n) => ({
      source: n + 1,
      document_number: i.document_number,
      title: i.title,
      type: i.type,
      agencies: [...i.agencies],
      tier: i.tier,
      tierReason: i.tierReason,
      deadline: i.deadline ? dated(i.deadline) : null,
      dates: (i.datesShown ?? (i.deadline ? [i.deadline] : [])).map(dated),
      owner: owner(i.owner),
      areas: [...i.areas],
      reason: i.reason,
      action: i.action,
      citation: i.citation,
      url: i.url,
    })),
    checkedByYou: view.checkedByYou.map((c) => ({ ...note(c), tier: "Not tiered", owner: owner(c.owner), url: c.url })),
    heldBack: view.dropped.map(note),
    screenedOut: view.screenedOut.map(note),
    profile: {
      name: profile.name,
      summary: profile.summary,
      businessLines: [...profile.businessLines],
      applies: [...profile.applies],
      doesNotApply: [...profile.doesNotApply],
      areas: Object.entries(profile.areas).map(([name, a]) => ({ name, description: a.description, owner: owner(a.owner) })),
      generalCounsel: owner(profile.generalCounsel),
    },
  };
}

/**
 * The chat's IndexedDB key when the run has a finished report, else null: the chat never shows while a run is running,
 * or after it failed or was interrupted. Live runs and examples are keyed apart (`live:<id>`, `example:<id>`).
 */
export function followUpChatId(kind: "live" | "example", id: string, status: string): string | null {
  return status === "done" ? `${kind}:${id}` : null;
}

/** One NDJSON line of /api/followup's answer: a piece of text, then exactly one of done or failed. */
export type FollowUpLine = { type: "text"; text: string } | { type: "done" } | { type: "failed"; message: string };

export type AskResult = { ok: true; turns: ChatTurn[] } | { ok: false; message: string };

export interface AskDeps {
  fetch: typeof fetch;
  store: Pick<RunStore, "saveChat">;
  /** Each piece of the answer as it streams in. */
  onText: (text: string) => void;
  /** ISO timestamp for savedAt. */
  now: () => string;
}

/**
 * Asks one question about the report: POSTs the context and the conversation (the trimmed question last) to
 * /api/followup and streams the answer through `onText`. Only a finished answer is kept: the conversation with the new
 * pair is saved under `chatId` and returned. A refusal, a failure part-way, a dropped connection or an empty answer is
 * a sentence for the GC, and nothing is saved, so a reload never shows half an answer.
 */
export async function askFollowUp(req: { chatId: string; context: FollowUpContext; turns: ChatTurn[]; question: string }, deps: AskDeps): Promise<AskResult> {
  const question = req.question.trim();
  if (!question) return { ok: false, message: EMPTY_QUESTION };
  const messages: ChatTurn[] = [...req.turns, { role: "user", content: question }];
  let answer = "";
  let end: FollowUpLine | null = null;
  try {
    const res = await deps.fetch("/api/followup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ context: req.context, messages }) });
    if (!res.ok || !res.body) {
      // The route answers refusals with one plain sentence; anything else (an HTML error page, a platform timeout)
      // is never shown to the GC.
      const plain = (res.headers.get("content-type") ?? "").startsWith("text/plain");
      const text = plain ? (await res.text()).trim() : "";
      return { ok: false, message: text || FOLLOWUP_UNAVAILABLE };
    }
    await readNdjson<FollowUpLine>(res.body, (line) => {
      if (line.type === "text") {
        answer += line.text;
        deps.onText(line.text);
      } else end = line;
    });
  } catch (e) {
    console.warn("[FollowUp] request failed:", e);
    return { ok: false, message: answer ? FOLLOWUP_FAILED : FOLLOWUP_UNAVAILABLE };
  }
  const last = end as FollowUpLine | null;
  if (last?.type === "failed") return { ok: false, message: last.message };
  if (last?.type !== "done" || !answer.trim()) return { ok: false, message: FOLLOWUP_FAILED };
  const turns: ChatTurn[] = [...messages, { role: "assistant", content: answer }];
  await deps.store.saveChat({ id: req.chatId, savedAt: deps.now(), turns });
  return { ok: true, turns };
}
