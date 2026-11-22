#!/usr/bin/env bash
# Chunk 05 verification gates. Run from anywhere inside the repo; exits non-zero on the first failure.
# PORT overrides the local server's port (default 3501, inside this wave's 3501-3509). Every server runs keyless
# (AI_GATEWAY_API_KEY= empty), so no gate can spend Gateway credit.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail() { echo "FAIL: $*" >&2; exit 1; }
export PORT="${PORT:-3501}"

# Gate 1: chunk 04's gates (03's lint, test, build, typecheck, decision-path parity, no fs writes, no poc/; 04's
# route guard, browser imports and bundle names), then 08's typed-number check and the eval bundle check.
bash plans/2026-11-22-demo-build/04-run-and-report/gates.sh
bash plans/2026-11-22-demo-build/08-eval-summary-iterations/no-typed-numbers.sh
bash scripts/verify-eval-bundle.sh

# One keyless server for gates 2 and 3.
if lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then fail "port $PORT is already in use"; fi
AI_GATEWAY_API_KEY= ./node_modules/.bin/next start -p "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "localhost:$PORT/runs/new" && break; sleep 0.25; done
TMP=$(mktemp -d)
code=$(curl -s -o "$TMP/new.html" -w '%{http_code}' "localhost:$PORT/runs/new")
suggest_code=$(curl -s -o "$TMP/suggest.txt" -w '%{http_code}' -X POST "localhost:$PORT/api/suggest-areas" \
  -H 'content-type: application/json' -d '{"description":"US fintech: P2P payments and a custodial crypto wallet."}')
empty_code=$(curl -s -o "$TMP/empty.txt" -w '%{http_code}' -X POST "localhost:$PORT/api/suggest-areas" \
  -H 'content-type: application/json' -d '{"description":"   "}')
kill $SRV; wait $SRV 2>/dev/null || true; trap - EXIT

# Gate 2 (amendment 11, Decision 12): /runs/new offers the demo presets and never an eval company.
# Props reach the HTML as an escaped RSC payload (\"ledgerly\"), so the presence needle accepts either quoting, and the
# absence needles are bare, case-insensitive words: a quoted "brightside" needle would miss an escaped leak.
[ "$code" = "200" ] || fail "/runs/new answered $code"
if [ "$(grep -cE '\\?"ledgerly\\?"' "$TMP/new.html" || true)" -lt 1 ]; then fail "ledgerly missing from /runs/new"; fi
for id in brightside cornercare skyhop; do
  if grep -qi "$id" "$TMP/new.html"; then fail "eval company $id offered on /runs/new"; fi
done

# Gate 3 (Decision 9, amendment 10): no model id, env-variable name or config key in the GC-facing page or in the
# keyless suggest-areas answers; keyless, the suggestion is refused with a plain 503 before any model call.
model=$(sed -n 's/^  model: //p' config/app.yaml)
[ -n "$model" ] || fail "no suggestAreas model found in config/app.yaml"
for f in "$TMP/new.html" "$TMP/suggest.txt" "$TMP/empty.txt"; do
  for needle in "$model" AI_GATEWAY suggestAreas; do
    if grep -qF "$needle" "$f"; then fail "'$needle' in $(basename "$f")"; fi
  done
done
[ "$suggest_code" = "503" ] || fail "keyless suggest-areas answered $suggest_code, not 503"
[ "$empty_code" = "400" ] || fail "empty description answered $empty_code, not 400"

# Gate 4 (amendment 7): the hard-coded demo run is gone, importers included.
[ ! -e src/lib/runs/demo.ts ] || fail "src/lib/runs/demo.ts still exists"
if grep -rn "DEMO_RUN\|runs/demo" src; then fail "DEMO_RUN still referenced"; fi

# Type check last (prompts/gates.md): vitest transpiles without type-checking, and the build skips test files.
pnpm typecheck

echo "chunk 05 gates: OK"
