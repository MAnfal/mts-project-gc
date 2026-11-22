// The browser side of "Suggest from description": one POST to /api/suggest-areas, with every outcome turned into a
// value the screen can show. Pure apart from the injected fetch, so each branch is tested.

export interface SuggestedArea {
  id: string;
  description: string;
}

export type SuggestResult = { ok: true; areas: SuggestedArea[] } | { ok: false; message: string };

/** The route's own sentence for a failed suggestion, reused when the answer isn't one of its plain sentences. */
export const SUGGEST_UNAVAILABLE = "Suggestions aren't available right now. Add the areas yourself, or try again later.";

const isArea = (a: unknown): a is SuggestedArea =>
  typeof a === "object" && a !== null && typeof (a as SuggestedArea).id === "string" && typeof (a as SuggestedArea).description === "string";

export async function requestSuggestions(description: string, f: typeof fetch): Promise<SuggestResult> {
  try {
    const res = await f("/api/suggest-areas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ description }) });
    if (!res.ok) {
      // The route answers refusals with one plain sentence; anything else (an HTML error page, a platform timeout)
      // is never shown to the GC.
      const plain = (res.headers.get("content-type") ?? "").startsWith("text/plain");
      const text = plain ? (await res.text()).trim() : "";
      return { ok: false, message: text || SUGGEST_UNAVAILABLE };
    }
    // A body without an areas list throws here and lands in the catch below.
    const { areas } = (await res.json()) as { areas: unknown[] };
    return { ok: true, areas: areas.filter(isArea) };
  } catch {
    return { ok: false, message: SUGGEST_UNAVAILABLE };
  }
}
