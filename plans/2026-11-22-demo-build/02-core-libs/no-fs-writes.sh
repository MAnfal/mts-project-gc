#!/usr/bin/env bash
# Chunk 02, Gate 3: no filesystem writes in server code under src/lib.
#
# Scope: every .ts/.tsx under src/lib except *.test.ts(x). Test files are excluded on purpose: they
# write throwaway fixtures to os.tmpdir() (chunk 01's load.test.ts does), and they never ship in a
# function bundle. Comment lines are skipped so a comment naming a forbidden call doesn't trip it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

files=$(find src/lib -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' | sort)
count=$(printf '%s\n' "$files" | grep -c . || true)
[ "$count" -ge 1 ] || { echo "FAIL: no server source files found under src/lib" >&2; exit 1; }

# grep -H keeps the file name even for a single file; strip `path:line:` before testing for a comment.
hits=$(printf '%s\n' "$files" | xargs grep -nHE 'writeFile|appendFile|mkdirSync|fs\.mkdir|writeFileSync' \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' || true)
if [ -n "$hits" ]; then
  echo "FAIL: filesystem write in src/lib server code:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "no-fs-writes: OK ($count server files under src/lib scanned)"
