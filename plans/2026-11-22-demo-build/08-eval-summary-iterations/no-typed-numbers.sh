#!/usr/bin/env bash
# Chunk 08, Gate 2: no hard-coded eval numbers in the eval view or its prose.
#
# Eval numbers reach the page only from public/evals/index.json (src/lib/evals/loader.ts), prose numbers only
# as {{placeholders}} or verbatim quotes (src/lib/evals/story.ts). These needles are the mockup's headline
# figures (design/HiEvalSummary.dc.html); finding one in a component, page or config/eval-story.yaml means it
# was typed from the mockup. config/eval-story.yaml is also guarded by EvalStorySchema (no digits in prose).
# Missing paths are reported and fail the gate, so it can't pass by scanning nothing.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

PATHS=(src/components/evals src/app/evals config/eval-story.yaml)
for p in "${PATHS[@]}"; do [ -e "$p" ] || { echo "FAIL: $p does not exist" >&2; exit 1; }; done
if grep -rnE '89\.8|81\.5|72\.6|63%|\$0\.52' "${PATHS[@]}"; then
  echo "FAIL: hard-coded eval number" >&2
  exit 1
fi
echo "no-typed-numbers: OK ($(find src/components/evals src/app/evals -type f | wc -l | tr -d ' ') component/page files + config/eval-story.yaml scanned)"
