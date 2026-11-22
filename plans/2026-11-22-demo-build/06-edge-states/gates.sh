#!/usr/bin/env bash
# Chunk 06 verification gates. Run from anywhere inside the repo; exits non-zero on the first failure.
# PORT overrides the local server's port (default 3601, inside this chunk's 3601-3609). Every server runs keyless
# (AI_GATEWAY_API_KEY= empty), so no gate can spend Gateway credit. Needs the POC checkout (scripts/poc-src.sh), as
# 05's eval bundle check already does: the examples rebuild runs under its tsx.
#
# Each check is a function over its input, so its canary (plans/.../06-edge-states/completion-report.md) feeds it a
# planted input instead of editing the tree.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail() { echo "FAIL: $*" >&2; exit 1; }
export PORT="${PORT:-3601}"

# Internal names that must never reach a GC page or a file it fetches: component and stage ids, model ids and vendors,
# and the run record's internal fields (as JSON keys: the bare words "cell" and "model" occur in rule titles).
INTERNAL='jev|typesafe|claude-|anthropic/|openai/|moonshotai/|filter:(llm|passages)|verify\+tier|output:actions|scan:federal|configHash|costUsd|STEP_LABELS|"(cell|setup|model|prompt|calls|decisions)"'

# Gate 2: no internal name in GC-facing code. Fails when a listed directory is missing, so it can't pass by reading nothing.
gate_gc_code() {
  for d in "$@"; do [ -d "$d" ] || fail "$d is missing"; done
  if grep -rniE "jev|typesafe-ai" --exclude='*.test.*' --exclude-dir='__fixtures__' "$@"; then fail "internal name in GC-facing code"; fi
}

# Gate 3: every file under public/examples is free of internal names, and there is one per finished example run.
gate_examples_scan() { # <dir> <expected example count>
  local dir=$1 expected=$2 files n
  files=$(find "$dir" -type f | sort)
  n=$(printf '%s\n' "$files" | grep -c '\.json$' || true)
  [ "$n" -eq $((expected + 1)) ] || fail "$dir holds $n JSON files, expected $expected examples + index.json"
  if printf '%s\n' "$files" | xargs grep -liE "$INTERNAL"; then fail "internal name in a file under $dir"; fi
  echo "Gate 3: $n files under $dir scanned"
}

# Gate 4 (Decision 9): GC code never reads the eval bundle: no import of lib/evals or components/evals, no "/evals" URL.
gate_gc_reads() {
  local hits
  hits=$(grep -rnE "(lib|components)/evals|[\"'\`]/evals" --exclude='*.test.*' --exclude-dir='__fixtures__' "$@" || true)
  [ -z "$hits" ] || fail "GC code reads the eval bundle:
$hits"
}

# Gate 6: no poc/ path, counted (a negated grep can't fail under set -e).
count_poc() { grep -c '^poc/' || true; }
gate_no_poc() { # <label> reads a path list on stdin
  local n
  n=$(count_poc)
  [ "$n" -eq 0 ] || fail "$n poc/ path(s) in $1"
}

[ "${GATES_LIB_ONLY:-}" = 1 ] && return 0 2>/dev/null || true

# Gate 1: chunk 05's gates (04 → 03: lint, test, build, decision-path parity, no fs writes, no poc/ on HEAD, browser
# imports, GC bundle names with /examples/[id] added; 08's typed numbers; the eval bundle check; 05's page checks).
bash plans/2026-11-22-demo-build/05-new-run-screen/gates.sh

GC_DIRS=(src/components/gc src/lib/runs src/app/runs src/app/examples)
gate_gc_code "${GC_DIRS[@]}"
echo "Gate 2: OK"

# Gate 3: rebuild the examples (idempotent: the committed files must be exactly what the projection writes), then scan.
bash scripts/build-examples.sh
dirty=$(git status --porcelain --untracked-files=all public/examples)
[ -z "$dirty" ] || fail "public/examples differs from a fresh build (rebuild with bash scripts/build-examples.sh and commit):
$dirty"
done_runs=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("public/evals/user-view/runs-index.json","utf8")).filter((r)=>r.status==="done").length)')
[ "$done_runs" -gt 0 ] || fail "no finished example run in the bundle"
gate_examples_scan public/examples "$done_runs"

gate_gc_reads "${GC_DIRS[@]}"
echo "Gate 4: OK"

# Gate 5: the pages answer on a keyless server, and what a GC page fetches names nothing internal.
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then fail "port $PORT is already in use"; fi
AI_GATEWAY_API_KEY= ./node_modules/.bin/next start -p "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "localhost:$PORT/" && break; sleep 0.25; done
TMP=$(mktemp -d)
ex=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("public/examples/index.json","utf8"))[0].id)')
failed=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("public/evals/user-view/runs-index.json","utf8")).find((r)=>r.status==="error").runId)')
suite=$(ls public/evals/suites | head -1)
suite_run=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).at(-1).runId)' "public/evals/suites/$suite/runs-index.json")
get() { curl -s -o "$TMP/$1" -w '%{http_code}' "localhost:$PORT$2"; }
c_index=$(get index.json /examples/index.json)
c_file=$(get example.json "/examples/$ex.json")
c_page=$(get example.html "/examples/$ex")
c_from=$(get from.html "/runs/new?from=$ex")
c_rep_uv=$(get report-uv.html "/evals/reports/user-view/$failed")
c_rep_suite=$(get report-suite.html "/evals/reports/$suite/$suite_run")
kill $SRV; wait $SRV 2>/dev/null || true; trap - EXIT
for pair in "index.json:$c_index" "example.json:$c_file" "example.html:$c_page" "from.html:$c_from" "report-uv.html:$c_rep_uv" "report-suite.html:$c_rep_suite"; do
  [ "${pair##*:}" = 200 ] || fail "${pair%%:*} answered ${pair##*:}"
done
cmp -s "$TMP/example.json" "public/examples/$ex.json" || fail "/examples/$ex.json is not the static file (a route answered instead)"
cmp -s "$TMP/index.json" public/examples/index.json || fail "/examples/index.json is not the static file"
for f in example.html from.html; do
  if grep -liE "$INTERNAL" "$TMP/$f"; then fail "internal name in GC page $f"; fi
done
echo "Gate 5: examples, prefill and reviewer report pages answer 200 (keyless)"

git ls-tree -r --name-only HEAD | gate_no_poc "HEAD's tree"
git log --name-only --format= feat/plan--demo-build..HEAD | gate_no_poc "commits since feat/plan--demo-build"
echo "Gate 6: no poc/ path"

# Type check last (prompts/gates.md).
pnpm typecheck

echo "chunk 06 gates: OK"
