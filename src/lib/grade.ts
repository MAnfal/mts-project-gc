// From poc:poc/src/lib/grade.ts: only the vote counter the LLM filter's majority vote (combineFilterPasses) uses.
// The rest of the POC's grading code is not part of the live pipeline.

export type Verdict = "PASS" | "FAIL" | "UNKNOWN";
/** Judge-panel vote: a verdict needs `minAgree` matching votes; UNKNOWN is an abstention. */
export function majority(votes: Verdict[], minAgree: number): "PASS" | "FAIL" | "CONTESTED" {
  const pass = votes.filter((v) => v === "PASS").length;
  const fail = votes.filter((v) => v === "FAIL").length;
  if (pass >= minAgree && pass > fail) return "PASS";
  if (fail >= minAgree && fail > pass) return "FAIL";
  return "CONTESTED";
}
