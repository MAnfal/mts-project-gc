#!/usr/bin/env bash
# Chunk 02, Gate 3: no filesystem writes in server code.
#
# Scope: every .ts/.tsx under src/ except *.test.ts(x). That is all code that can ship in a function
# bundle (src/lib, src/app routes and pages, components). Test files are excluded on purpose: they write
# throwaway fixtures to os.tmpdir() (chunk 01's load.test.ts does) and never ship.
#
# Needles are call forms of every Node fs API that creates, changes or deletes a file or directory, so
# they match `fs.writeFile(`, `fsp.mkdir(`, `fs.promises.rm(` and a destructured `mkdir(` alike.
# Comment lines are skipped so a comment naming a forbidden call doesn't trip it.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

files=$(find src -type f \( -name '*.ts' -o -name '*.tsx' \) ! -name '*.test.ts' ! -name '*.test.tsx' | sort)
count=$(printf '%s\n' "$files" | grep -c . || true)
[ "$count" -ge 1 ] || { echo "FAIL: no source files found under src/" >&2; exit 1; }

WRITES='writeFile|writeFileSync|appendFile|appendFileSync|mkdir|mkdirSync|mkdtemp|mkdtempSync|createWriteStream'
WRITES+='|rename|renameSync|copyFile|copyFileSync|cp|cpSync|rm|rmSync|rmdir|rmdirSync|unlink|unlinkSync'
WRITES+='|truncate|truncateSync|symlink|symlinkSync'

# grep -H keeps the file name even for a single file; strip `path:line:` before testing for a comment.
hits=$(printf '%s\n' "$files" | xargs grep -nHE "\\b($WRITES)[[:space:]]*\\(" \
  | grep -vE '^[^:]+:[0-9]+:[[:space:]]*(//|\*|/\*)' || true)
if [ -n "$hits" ]; then
  echo "FAIL: filesystem write in server code:" >&2
  echo "$hits" >&2
  exit 1
fi
echo "no-fs-writes: OK ($count non-test source files under src/ scanned)"
