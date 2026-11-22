#!/usr/bin/env bash
# Chunk 08, Gate 2: no hard-coded eval numbers in the eval view or its prose.
#
# Eval numbers reach the page only from public/evals/index.json (src/lib/evals/loader.ts), prose numbers only
# as {{placeholders}} or verbatim quotes (src/lib/evals/story.ts). Needles:
#   - the mockup's headline figures (design/HiEvalSummary.dc.html): 89.8, 81.5, 72.6, 63%, $0.52;
#   - the CARL Context/Action counts, typed as prose: 157, "20 rules", "<n> changes", "<n> were kept".
#   - chunk 09 (Cases, Runs, trace viewer; design/HiEvalCases.dc.html): the case total "All 177 cases", the
#     largest trace's 2,104 events, the 439 suite runs, a typed repeat tally such as "3/3", and "8 trace checks".
# Finding one in a component, page or config/eval-story.yaml means it was typed rather than read from data.
# (Bare 20 is not a needle: SVG sizes use it.) config/eval-story.yaml is also guarded by EvalStorySchema.
# Missing paths are reported and fail the gate, so it can't pass by scanning nothing.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PATHS=(src/components/evals src/app/evals config/eval-story.yaml)
for p in "${PATHS[@]}"; do [ -e "$p" ] || { echo "FAIL: $p does not exist" >&2; exit 1; }; done
NEEDLES='89\.8|81\.5|72\.6|63%|\$0\.52|\b157\b|\b20 rules|\b[0-9]+ changes\b|\b[0-9]+ were kept\b|\b177\b|2,104|\b2104\b|\b439\b|\b[0-9]/3\b|\b[0-9]+ trace checks\b'
if grep -rnE "$NEEDLES" "${PATHS[@]}"; then
  echo "FAIL: hard-coded eval number" >&2
  exit 1
fi
echo "no-typed-numbers: OK ($(find src/components/evals src/app/evals -type f | wc -l | tr -d ' ') component/page files + config/eval-story.yaml scanned)"
