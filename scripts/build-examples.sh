#!/usr/bin/env bash
# Rebuild public/examples/ (the GC's example runs) from the shipped eval bundle. See scripts/build-examples.mts.
# Runs the .mts under the POC checkout's tsx (scripts/poc-src.sh), as the eval bundle scripts do: this repo has no
# TypeScript runner of its own. --conditions=react-server resolves `server-only` to its empty module.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
# shellcheck source=scripts/poc-src.sh
source "$ROOT/scripts/poc-src.sh"
ensure_poc_src
"$TSX" --conditions=react-server "$ROOT/scripts/build-examples.mts"
