#!/usr/bin/env bash
# Chunk 11 verification gates. Run from anywhere inside the repo; exits non-zero on the first failure.
# PORT overrides the local server's port (default 3801, inside this chunk's 3801-3809). Every server runs keyless
# (AI_GATEWAY_API_KEY= empty), so no gate can spend Gateway credit. The live check of a streamed answer is the lead's,
# after merge (amendment 11).
#
# Each check is a function over its input, so its canary (completion-report.md) feeds it a planted input instead of
# editing the tree. GATES_LIB_ONLY=1 sources the functions without running anything.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail() { echo "FAIL: $*" >&2; exit 1; }
export PORT="${PORT:-3801}"

# Gate 3: the keyless answers of /api/followup. <dir> holds <name>.code (the HTTP status), <name>.type (the
# content-type) and <name>.txt (the body) for each request below; <needles> are the strings no answer may contain.
#   ok        a valid question: refused before any model call, because the server has no Gateway key (503)
#   noitems   a context without its items list (400)
#   long      a conversation one message over maxTurns (400)
#   internal  a context naming an internal model in a document title (400)
#   notjson   a body that isn't JSON (400)
gate_followup_answers() { # <dir> <needle>...
  local dir=$1 name want got type needle
  shift
  [ "$#" -ge 1 ] || fail "no needles given"
  for pair in ok:503 noitems:400 long:400 internal:400 notjson:400; do
    name=${pair%%:*} want=${pair##*:}
    [ -f "$dir/$name.code" ] && [ -f "$dir/$name.txt" ] && [ -f "$dir/$name.type" ] || fail "no captured answer for '$name' in $dir"
    got=$(cat "$dir/$name.code")
    [ "$got" = "$want" ] || fail "/api/followup '$name' answered $got, not $want"
    type=$(cat "$dir/$name.type")
    case "$type" in text/plain*) ;; *) fail "/api/followup '$name' answered with content-type '$type', not a plain sentence" ;; esac
    [ -s "$dir/$name.txt" ] || fail "/api/followup '$name' answered an empty body"
    for needle in "$@"; do
      if grep -qiF -- "$needle" "$dir/$name.txt"; then fail "'$needle' in the '$name' answer of /api/followup"; fi
    done
  done
  echo "Gate 3: /api/followup answers 503 keyless and 400 to each bad body, naming nothing internal"
}

# Gate 4: no poc/ path, counted (a negated grep can't fail under set -e).
gate_no_poc() { # <label>, reads a path list on stdin
  local n
  n=$(grep -c '^poc/' || true)
  [ "$n" -eq 0 ] || fail "$n poc/ path(s) in $1"
}

[ "${GATES_LIB_ONLY:-}" = 1 ] && return 0 2>/dev/null || true

# Gate 1: chunk 06's gates, keyless (05 → 04 → 03: lint, tests, build, parity, no fs writes, browser imports, GC bundle
# names, examples rebuild and scan, the example and reviewer pages, typecheck).
AI_GATEWAY_API_KEY= bash plans/2026-11-22-demo-build/06-edge-states/gates.sh

# Gate 2 (amendment 1): the chat's mount condition is a test, not a page grep: hidden while a run is running, failed or
# interrupted, shown on a finished live run and on an example. The chat renders in the browser after IndexedDB answers,
# so no server HTML can show it either way.
pnpm exec vitest run src/components/gc/FollowUpMount.test.ts
echo "Gate 2: mount condition tested"

# Gate 3: keyless requests to /api/followup.
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then fail "port $PORT is already in use"; fi
AI_GATEWAY_API_KEY= ./node_modules/.bin/next start -p "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "localhost:$PORT/" && break; sleep 0.25; done
TMP=$(mktemp -d)
# A minimal valid body; each bad body differs from it in one way.
ok=$(node -e '
const owner = { name: "Jordan Blake", email: "gc@example.com" };
const context = { company: "Ledgerly Inc.", windowStart: "2026-11-02", windowEnd: "2026-11-06", asOf: "2026-11-06", scanned: 3, notReviewedCount: 0,
  items: [], checkedByYou: [], heldBack: [], screenedOut: [{ document_number: "2026-1", title: "A notice", reason: "Not about payments." }],
  profile: { name: "Ledgerly Inc.", summary: "US fintech", businessLines: [], applies: [], doesNotApply: [], areas: [], generalCounsel: owner } };
console.log(JSON.stringify({ context, messages: [{ role: "user", content: "Summarize for the CEO in 3 lines" }] }));')
# Each body is assigned before it is posted, so a broken edit stops the gate (set -e) instead of posting nothing.
edit() { node -e 'const b = JSON.parse(process.argv[1]); (new Function("b", process.argv[2]))(b); console.log(JSON.stringify(b));' "$ok" "$1"; }
maxTurns=$(sed -n 's/^  maxTurns: *//p' config/app.yaml)
[ -n "$maxTurns" ] || fail "no followUp maxTurns in config/app.yaml"
noitems=$(edit 'delete b.context.items')
long=$(MAX_TURNS="$maxTurns" edit 'b.messages = Array.from({ length: Number(process.env.MAX_TURNS) + 1 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "q" + i }))')
internal=$(edit 'b.context.screenedOut[0].title = "Scored by typesafe-ai/jev"')
post() { # <name> <body>
  curl -s -o "$TMP/$1.txt" -w '%{http_code}\n%{content_type}' -X POST "localhost:$PORT/api/followup" -H 'content-type: application/json' --data-binary "$2" >"$TMP/$1.meta"
  sed -n 1p "$TMP/$1.meta" >"$TMP/$1.code"
  sed -n 2p "$TMP/$1.meta" >"$TMP/$1.type"
}
post ok "$ok"
post noitems "$noitems"
post long "$long"
post internal "$internal"
post notjson '{not json'
kill $SRV; wait $SRV 2>/dev/null || true; trap - EXIT
# Every model id in app.yaml (suggestAreas and followUp keep the two-space `model:` indent 05's gate reads), the key's
# variable, and the config key itself.
models=$(sed -n 's/^  model: //p' config/app.yaml)
[ "$(printf '%s\n' "$models" | grep -c .)" -ge 2 ] || fail "expected the suggestAreas and followUp models in config/app.yaml"
needles=(AI_GATEWAY followUp)
while IFS= read -r m; do needles+=("$m"); done <<<"$models"
gate_followup_answers "$TMP" "${needles[@]}"

git ls-tree -r --name-only HEAD | gate_no_poc "HEAD's tree"
git log --name-only --format= feat/plan--demo-build..HEAD | gate_no_poc "commits since feat/plan--demo-build"
echo "Gate 4: no poc/ path"

# Type check last (prompts/gates.md).
pnpm typecheck

echo "chunk 11 gates: OK"
