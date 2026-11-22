#!/usr/bin/env bash
# Chunk 02, Gate 2: the demo's decision path is byte-identical to the evaluated POC.
#
# Compares the working tree against the `poc` branch (override with POC_REF) without touching it:
# every POC file is read with `git show`, never checked out. Exits non-zero on the first mismatch
# and names the file. Run from anywhere inside the repo.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

REF=${POC_REF:-poc}
fail() { echo "FAIL: $*" >&2; exit 1; }
git rev-parse --verify -q "$REF^{commit}" >/dev/null || fail "no '$REF' ref to compare against"

# same <path in REF> <path in working tree>: byte-identical, and the local file exists.
same() {
  [ -f "$2" ] || fail "$2 is missing"
  git show "$REF:$1" | cmp -s - "$2" || fail "$2 differs from $REF:$1"
}

# 1. Decision-path config files, one by one.
for f in prompts.yaml pipeline.yaml setups.yaml judges.yaml experiment.yaml \
         companies/cornercare.yaml companies/hearth.yaml companies/ledgerly.yaml companies/skyhop.yaml; do
  same "poc/config/$f" "config/$f"
done

# 2. Directory trees: the same file list in both directions (nothing missing, nothing extra),
#    and every file byte-identical.
for d in prompt-sets evalsets; do
  want=$(git ls-tree -r --name-only "$REF" "poc/config/$d/" | sed 's#^poc/config/##' | sort)
  [ -n "$want" ] || fail "$REF has no files under poc/config/$d"
  [ -d "config/$d" ] || fail "config/$d is missing"
  have=$(cd config && find "$d" -type f | sort)
  if [ "$want" != "$have" ]; then
    fail "config/$d file list differs from $REF: $(diff <(echo "$want") <(echo "$have") | grep '^[<>]' | tr '\n' ' ')"
  fi
  while IFS= read -r f; do same "poc/config/$f" "config/$f"; done <<<"$want"
done

# 3. brightside.yaml: the POC file with exactly one line, `use: eval`, inserted after `id:`.
src=$(git show "$REF:poc/config/companies/brightside.yaml")
[ "$(grep -c '^id: ' <<<"$src")" -eq 1 ] || fail "$REF brightside.yaml must have exactly one 'id:' line"
[ "$(grep -c '^use:' <<<"$src" || true)" -eq 0 ] || fail "$REF brightside.yaml already has a 'use:' line"
[ -f config/companies/brightside.yaml ] || fail "config/companies/brightside.yaml is missing"
git show "$REF:poc/config/companies/brightside.yaml" | awk '{ print } /^id: / { print "use: eval" }' \
  | cmp -s - config/companies/brightside.yaml \
  || fail "config/companies/brightside.yaml is not the POC file plus one 'use: eval' line after 'id:'"

# 4. The golden prompt fixture the prompt-parity test reads.
same poc/tests/fixtures/recorded-prompts.json src/lib/__fixtures__/recorded-prompts.json

# 5. Decision logic ported verbatim (relative imports, so no line differs).
for f in tier.ts verify.ts prompts.ts; do
  same "poc/src/lib/$f" "src/lib/$f"
done

echo "parity: OK (decision-path config, brightside +1 line, golden fixture, tier/verify/prompts)"
