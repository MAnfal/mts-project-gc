#!/usr/bin/env bash
# Rebuild public/evals/ — the POC's recorded evaluation as static files — from the `poc` branch.
#
#   bash scripts/build-eval-bundle.sh && bash scripts/verify-eval-bundle.sh
#
# Idempotent: public/evals/ is deleted and regenerated on every run. Never hand-edit it.
# Each suites/<id>/manifest.json carries export.mts's `exportedAt` timestamp, so those 9 files change on
# every rebuild; everything else is byte-stable.
#
# Steps:
#   1. A detached checkout of `poc` at <main checkout>/.worktrees/poc-src (created if absent; see
#      scripts/poc-src.sh), then `pnpm install` in its poc/ dir.
#   2. For each arena id under poc:poc/data/evals/, the POC's own `scripts/export.mts <arenaId>`, which
#      writes data/exports/<arenaId>/ inside the POC worktree (gitignored there) using suiteReport and
#      checkTrace, unmodified.
#   3. Assemble public/evals/ in the layout chunks 08–10 read (see .claude/resources/project.md → Layout):
#      suites/<id>/{manifest,report,trace-checks}.json, runs.jsonl.gz and traces/ from each export; one
#      shared config/ (the 9 per-suite copies are checked identical to poc/config and dropped); user-view/
#      runs and traces from poc/data/user-view (all 22, failed ones included; export.mts keeps only finished
#      ones); iterations/ copied verbatim from poc/data/iterations (spec, record, evidence, diffs and config
#      snapshot).
#   4. scripts/build-eval-index.mts, under the POC's tsx: keeps any run export.mts skipped (flagged
#      superseded), writes index.json, iterations/*/iteration.json and user-view/index.json.
#   5. Nothing in the POC worktree is removed or edited (export.mts replaces only its own data/exports/<id>/).
#
# No model is called and nothing is spent: export and grading read recorded runs only, and the POC's
# gateway key is set to a dummy value so any accidental model call fails on auth.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
# shellcheck source=scripts/poc-src.sh
source "$ROOT/scripts/poc-src.sh"
ensure_poc_src

export VERCEL_AI_GATEWAY_API_KEY="offline-no-model-calls"
export AI_GATEWAY_API_KEY="offline-no-model-calls"

OUT="$ROOT/public/evals"
ARENAS=()
while IFS= read -r a; do ARENAS+=("$(basename "$a")"); done < <(git -C "$MAIN" ls-tree --name-only "$POC_REF" poc/data/evals/)
[ "${#ARENAS[@]}" -gt 0 ] || { echo "FAIL: no suites under poc:poc/data/evals/" >&2; exit 1; }

# 2. Export every suite with the POC's own script.
for a in "${ARENAS[@]}"; do
  (cd "$POC" && "$TSX" scripts/export.mts "$a")
done

# 3. Assemble.
rm -rf "$OUT"
mkdir -p "$OUT/suites" "$OUT/user-view/runs" "$OUT/user-view/traces" "$OUT/iterations"

for a in "${ARENAS[@]}"; do
  src="$POC/data/exports/$a"
  # One shared config/: every export's copy must equal the POC's config, or dropping it would lose data.
  diff -r "$src/config" "$POC/config" >/dev/null || { echo "FAIL: $src/config differs from $POC/config" >&2; exit 1; }
  mkdir -p "$OUT/suites/$a"
  cp "$src/manifest.json" "$src/report.json" "$src/trace-checks.json" "$src/runs.jsonl.gz" "$OUT/suites/$a/"
  cp -R "$src/traces" "$OUT/suites/$a/traces"
done
cp -R "$POC/config" "$OUT/config"

cp "$POC"/data/user-view/runs/*.json "$OUT/user-view/runs/"
for t in "$POC"/data/user-view/traces/*; do
  name="$(basename "$t")"
  case "$name" in
    *.jsonl.gz) cp "$t" "$OUT/user-view/traces/$name" ;;
    # Not yet compacted on poc: gzip without name or timestamp, so the output is byte-stable.
    *.jsonl) gzip -n -9 -c "$t" >"$OUT/user-view/traces/$name.gz" ;;
    *) echo "FAIL: unexpected user-view trace $t" >&2; exit 1 ;;
  esac
done

cp -R "$POC"/data/iterations/. "$OUT/iterations/"

# 4. Derived files, computed by the POC's grading code over what was just assembled.
"$TSX" "$ROOT/scripts/build-eval-index.mts" --bundle "$OUT" --poc "$POC" --commit "$POC_REF" --poc-data "$POC/data"

echo "bundle: $(find "$OUT" -type f | wc -l | tr -d ' ') files, $(du -sm "$OUT" | cut -f1) MB at $OUT"
