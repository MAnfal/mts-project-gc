#!/usr/bin/env bash
# Chunk 04 verification gates. Run from anywhere inside the repo; exits non-zero on the first failure.
# PORT overrides the local server's port (default 3401; the plan's 3104 is outside this wave's 3401-3409 range).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail() { echo "FAIL: $*" >&2; exit 1; }
PORT="${PORT:-3401}"

# Gate 1: chunk 03's gates — lint, test, build, typecheck (last), decision-path parity, no fs writes, no poc/ on HEAD.
bash plans/2026-11-22-demo-build/03-pipeline/gates.sh

# Gate 2: the route validates before running anything (a 30-day window gets a 400; no model call, no spend).
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then fail "port $PORT is already in use"; fi
AI_GATEWAY_API_KEY= ./node_modules/.bin/next start -p "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "localhost:$PORT/" && break; sleep 0.25; done
code=$(curl -s -o /dev/null -w '%{http_code}' -X POST "localhost:$PORT/api/run" \
  -H 'content-type: application/json' -d '{"profileId":"ledgerly","windowStart":"2026-11-01","windowEnd":"2026-11-30"}')
kill $SRV; wait $SRV 2>/dev/null || true; trap - EXIT
[ "$code" = "400" ] || fail "30-day window not rejected ($code)"

# Gate 3: no poc/ path on this branch's tree or in any commit since the plan branch.
if git ls-tree -r --name-only HEAD | grep '^poc/'; then fail "poc/ path in HEAD tree"; fi
if git log --name-only --format= feat/plan--demo-build..HEAD | grep '^poc/'; then fail "poc/ path in a commit since feat/plan--demo-build"; fi

# Gate 4 (amendment 6): GC client code imports only types from pipeline/events.ts. A value import would bundle
# STEP_LABELS, whose keys and patterns name internal components. Server routes (src/app/api) may import values.
dirs=(src/lib/runs src/components/gc src/app)
for d in "${dirs[@]}"; do [ -d "$d" ] || fail "$d is missing"; done
files=$(find "${dirs[@]}" -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -path 'src/app/api/*' | sort)
[ "$(printf '%s\n' "$files" | grep -c .)" -ge 10 ] || fail "too few GC client files scanned"
bad=$(printf '%s\n' "$files" | xargs grep -nHE "from ['\"][^'\"]*pipeline/events['\"]" | grep -vE '^[^:]+:[0-9]+:import type \{' || true)
[ -z "$bad" ] || fail "value import from pipeline/events in GC client code:
$bad"

# Gate 5 (Decision 9): the browser bundle names no internal component or model.
[ -d .next/static/chunks ] || fail ".next/static/chunks missing: run pnpm build first"
if grep -rlE 'filter:jev|typesafe-ai|claude-sonnet|jevProbability|STEP_LABELS' .next/static; then fail "internal name in the client bundle"; fi

echo "chunk 04 gates: OK"
