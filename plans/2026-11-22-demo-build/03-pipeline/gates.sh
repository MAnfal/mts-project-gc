#!/usr/bin/env bash
# Chunk 03 verification gates: the plan's block, then chunk 02's decision-path gates, then the no-poc/ gate.
# Run from anywhere inside the repo. Exits non-zero on the first failure.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
fail() { echo "FAIL: $*" >&2; exit 1; }

# Gate 1: the standard set (type check last: vitest transpiles without type-checking).
pnpm lint
pnpm test
pnpm build
pnpm typecheck

# Gate 2: the reason leak is gone from source (tests included).
if grep -rn "Jev p=" src/; then fail "internal reason text in src"; fi

# Gate 3: no ledger or persistence in the pipeline. The directory must exist, or grep reads nothing and passes.
[ -d src/lib/pipeline ] || fail "src/lib/pipeline is missing"
if grep -rnE "saveRun|spentUsd|budgetUsd|spend-ledger" src/lib/pipeline; then fail "POC persistence/ledger ported"; fi

# Chunk 02's gates: decision-path config and libs byte-identical to the POC; no filesystem writes in server code.
bash plans/2026-11-22-demo-build/02-core-libs/parity.sh
bash plans/2026-11-22-demo-build/02-core-libs/no-fs-writes.sh

# No poc/ path is ever committed.
if git ls-tree -r --name-only HEAD | grep '^poc/'; then fail "poc/ path committed"; fi

echo "gates: OK"
