#!/usr/bin/env bash
# Chunk 01 verification gates. Run from the repository root:
#   bash plans/2026-11-22-demo-build/01-scaffold/gates.sh          # all gates, in order
#   bash plans/2026-11-22-demo-build/01-scaffold/gates.sh 3        # one gate (1–4), e.g. for base-tree falsification
# Gate 4 starts `pnpm start` on PORT (default 3101) and always stops it, pass or fail.
set -euo pipefail

PORT="${PORT:-3101}"
fail() { echo "FAIL: $*" >&2; exit 1; }

# Gate 1: install, lint, tests, build, then type check last.
gate1() {
  pnpm install --frozen-lockfile
  pnpm lint
  pnpm test
  pnpm build
  pnpm typecheck
}

# Gate 2: config ships with the server bundle. Needs a build (gate 1).
gate2() {
  test -f config/app.yaml || fail "config/app.yaml missing"
  if ! grep -qE '^[[:space:]]*outputFileTracingIncludes:' next.config.ts; then
    fail "next.config.ts declares no outputFileTracingIncludes"
  fi
  # The probe route never reads config itself, so config/app.yaml is in its trace only if the include works.
  local trace
  for trace in .next/server/app/page.js.nft.json .next/server/app/api/probe/stream/route.js.nft.json; do
    test -f "$trace" || fail "$trace missing (run gate 1 first)"
    if ! grep -qE '"[./]*config/app\.yaml"' "$trace"; then fail "config/app.yaml not traced into $trace"; fi
  done
  echo "gate 2 OK"
}

# Gate 3: no Flue claim left in the harness line; Stack measured.
gate3() {
  if grep -q "Harness: Flue" CLAUDE.md; then fail "CLAUDE.md still claims Flue"; fi
  if ! grep -q "Harness: plain Vercel AI SDK + AI Gateway (Flue/Pi deferred)" CLAUDE.md; then
    fail "CLAUDE.md has no Vercel AI SDK harness line"
  fi
  if grep -qi "Not yet measured" .claude/resources/project.md; then fail "Stack still unmeasured"; fi
  echo "gate 3 OK"
}

# Gate 4: the probe streams to `done` under `pnpm start` (local stand-in for the deployed check).
gate4() {
  test -f package.json || fail "no package.json — nothing to start"
  listeners() { lsof -t -i "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true; }
  [ -z "$(listeners)" ] || fail "port $PORT already in use"
  pnpm start -p "$PORT" >/dev/null 2>&1 &
  local srv=$!
  # Kill pnpm and the next-server child it spawned (by port), whatever happens below.
  trap 'kill '"$srv"' 2>/dev/null || true; lsof -t -i "tcp:'"$PORT"'" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null || true' EXIT
  local up=""
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null "http://localhost:$PORT/"; then up=1; break; fi
    if ! kill -0 "$srv" 2>/dev/null; then break; fi
    sleep 0.5
  done
  [ -n "$up" ] || fail "server did not come up on port $PORT"
  local out
  out=$(curl -sN --max-time 30 "http://localhost:$PORT/api/probe/stream?seconds=3") || true
  [ "$(printf '%s\n' "$out" | grep -c '^tick ')" -eq 3 ] || fail "probe did not stream 3 ticks: $out"
  [ "$(printf '%s\n' "$out" | tail -n 1)" = "done" ] || fail "probe did not finish: $out"
  echo "gate 4 OK"
}

case "${1:-all}" in
  1) gate1 ;;
  2) gate2 ;;
  3) gate3 ;;
  4) gate4 ;;
  all) gate1; gate2; gate3; gate4; echo "ALL GATES PASSED" ;;
  *) fail "unknown gate '$1' (use 1, 2, 3, 4 or all)" ;;
esac
