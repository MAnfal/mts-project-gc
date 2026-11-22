#!/usr/bin/env bash
# Chunk 02: every verification gate from plan.md, in order. Type check runs last (gates.md).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
DIR=plans/2026-11-22-demo-build/02-core-libs

pnpm lint
pnpm test
pnpm build
bash "$DIR/parity.sh"        # Gate 2: decision-path parity with poc:poc/
bash "$DIR/no-fs-writes.sh"  # Gate 3: no filesystem writes in non-test code under src/
pnpm typecheck
echo "chunk 02 gates: OK"
