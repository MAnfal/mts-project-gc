#!/usr/bin/env bash
# Plan 08 Gate 2, extended per preflight amendment 4 to config/eval-story.yaml.
set -e
cd /Users/anfal/Projects/hobby_projects/gc-ai-swe-take-home/.worktrees/08-eval-summary
if grep -rnE "89\.8|81\.5|72\.6|63%|\\\$0\.52" src/components/evals src/app/evals config/eval-story.yaml; then
  echo "FAIL: hard-coded eval number" >&2; exit 1; fi
echo "gate2: OK ($(find src/components/evals src/app/evals -type f | wc -l | tr -d ' ') component/page files + config/eval-story.yaml scanned)"
