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

# Gate 5 (Decision 9): the JS a GC page loads names no internal component or model. Decision 9 covers the
# GC-facing screens only: the eval view (/evals/**) is the reviewer's and legitimately says jev/jevProbability.
# The chunk list comes from Next 16.4.6's build output, not a directory glob:
#   - .next/build-manifest.json: rootMainFiles + polyfillFiles (loaded by every page);
#   - .next/server/app/<route>/page_client-reference-manifest.js: that route's entryJSFiles and every client
#     module's `chunks` (the file sets globalThis.__RSC_MANIFEST["/<route>/page"]);
#   - then, transitively, any static/chunks/*.js a listed chunk names (lazy chunks).
# GC routes: / and /runs/[id], plus /runs/new once it exists, and /examples/[id] (chunk 06: a recorded example run).
# GC_ROUTES overrides the list (used to prove the gate fails on a route that resolves to nothing). It fails if a
# required route has no manifest, a route lists no chunks, or a listed chunk is missing, so it can't pass by scanning
# nothing.
[ -d .next/static/chunks ] || fail ".next/static/chunks missing: run pnpm build first"
gc_chunks=$(GC_ROUTES="${GC_ROUTES:-page runs/[id]/page runs/new/page? examples/[id]/page}" node - <<'JS'
const fs = require("fs"), path = require("path"), vm = require("vm");
const die = (m) => { console.error(`FAIL: ${m}`); process.exit(1); };
const files = new Set();
const add = (f) => files.add(f.replace(/^\/_next\//, ""));
const bm = JSON.parse(fs.readFileSync(".next/build-manifest.json", "utf8"));
[...bm.rootMainFiles, ...bm.polyfillFiles].forEach(add);
let routes = 0;
for (const spec of process.env.GC_ROUTES.split(/\s+/).filter(Boolean)) {
  const optional = spec.endsWith("?");
  const route = optional ? spec.slice(0, -1) : spec;
  const file = path.join(".next/server/app", `${route}_client-reference-manifest.js`);
  if (!fs.existsSync(file)) {
    if (optional) { console.error(`Gate 5: optional GC route /${route.replace(/\/?page$/, "")} has no build output yet; skipped`); continue; }
    die(`GC route ${route} has no ${file}`);
  }
  const ctx = {}; ctx.globalThis = ctx;
  vm.runInNewContext(fs.readFileSync(file, "utf8"), ctx);
  const man = ctx.__RSC_MANIFEST?.[`/${route}`];
  if (!man) die(`${file} sets no __RSC_MANIFEST["/${route}"]`);
  const own = new Set([...Object.values(man.entryJSFiles ?? {}).flat(), ...Object.values(man.clientModules ?? {}).flatMap((m) => m.chunks ?? [])]);
  if (!own.size) die(`GC route ${route} resolved to 0 chunks`);
  own.forEach(add);
  routes++;
}
if (!routes) die("no GC route resolved");
const queue = [...files];
while (queue.length) {
  const f = queue.pop();
  const p = path.join(".next", f);
  if (!fs.existsSync(p)) die(`listed chunk ${p} is missing`);
  for (const m of fs.readFileSync(p, "utf8").matchAll(/static\/chunks\/[A-Za-z0-9_.-]+\.js/g))
    if (!files.has(m[0])) { files.add(m[0]); queue.push(m[0]); }
}
console.log([...files].filter((f) => f.endsWith(".js")).sort().map((f) => path.join(".next", f)).join("\n"));
JS
) || fail "could not resolve the GC routes' client chunks"
n=$(printf '%s\n' "$gc_chunks" | grep -c . || true)
[ "$n" -gt 0 ] || fail "GC routes resolved to 0 client chunks"
if printf '%s\n' "$gc_chunks" | xargs grep -lE 'filter:jev|typesafe-ai|claude-sonnet|jevProbability|STEP_LABELS'; then
  fail "internal name in a chunk a GC page loads"
fi
echo "Gate 5: $n client chunks of the GC routes scanned (eval-view chunks excluded)"

echo "chunk 04 gates: OK"
