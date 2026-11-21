/**
 * Passage excerpts for the LLM filter (setup knob `filterExcerpts`, iteration 06). The filter normally sees only
 * title + abstract, so provisions buried in long rules are invisible to it (e.g. the passenger power-bank limits deep
 * inside PHMSA's harmonization NPRM 2026-21922). For Jev's top-N documents we split the full text into passages, let
 * Jev score each passage against the company (Jev as a re-ranker), and hand the best k to the filter. Selection is by
 * content, never by position.
 */

/** Split text into whitespace-bounded passages of at most `size` chars; beyond `max`, keep an even spread. */
export function chunkText(text: string, size: number, max = Infinity): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur && cur.length + 1 + w.length > size) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur} ${w}` : w.slice(0, size);
  }
  if (cur) out.push(cur);
  if (out.length <= max) return out;
  return Array.from({ length: max }, (_, i) => out[Math.floor((i * out.length) / max)]);
}

/** The k highest-scoring passages, returned in document order. */
export function pickPassages(chunks: string[], scores: number[], k: number) {
  return chunks
    .map((text, index) => ({ index, text, p: scores[index] ?? 0 }))
    .sort((a, b) => b.p - a.p)
    .slice(0, k)
    .sort((a, b) => a.index - b.index);
}
