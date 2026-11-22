#!/usr/bin/env bash
# Usage: mutate.sh <name> <file> <perl-substitution> <test-file>
# Applies one mutation to a copy-backed file, runs one test file, records the failing tests, restores.
set -uo pipefail
WT=/Users/anfal/Projects/hobby_projects/gc-ai-swe-take-home/.worktrees/02-core-libs
OUT=/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-02/mut
name=$1; file=$2; sub=$3; test=$4
cd "$WT"
BK=$(mktemp -d); cp "$file" "$BK/orig"
perl -0pi -e "$sub" "$file"
if cmp -s "$BK/orig" "$file"; then echo "[$name] MUTATION DID NOT APPLY"; exit 2; fi
pnpm exec vitest run "$test" > "$OUT/$name.txt" 2>&1; rc=$?
cp "$BK/orig" "$file"
cmp -s "$BK/orig" "$file" || { echo "[$name] RESTORE FAILED"; exit 3; }
echo "[$name] vitest exit $rc; failing:"
grep -E "^ FAIL " "$OUT/$name.txt" | sed 's/^/    /' | head -8
grep -m3 -E "AssertionError|Error:" "$OUT/$name.txt" | sed 's/^/    /'
