#!/usr/bin/env bash
# Check that public/evals/ lost nothing from the `poc` branch and that its numbers recompute.
# Exits non-zero on any mismatch, after naming every failing file.
#
#   bash scripts/verify-eval-bundle.sh
#
# Compares against the `poc` branch itself (git archive of poc/data and poc/config), not against the POC
# worktree's working files:
#   - suites: one dir per arena id in poc:poc/data/evals/; runs.jsonl.gz holds exactly the run ids of
#     runs/*.json, each record equal to the POC's JSON; every trace is byte-identical, with no extras;
#   - user-view: every run file byte-identical, every trace byte-identical (traces still plain .jsonl on
#     poc are compared after gunzip), user-view/index.json lists all of them;
#   - iterations: every poc/data/iterations/* dir has iteration.json and byte-identical copies of its files;
#   - config/: identical to poc/config;
#   - index.json, iteration.json, user-view/index.json and every report.json: recomputed by the POC's
#     suiteReport (scripts/build-eval-index.mts --check, under the POC's tsx) from the shipped runs, traces
#     and keys, and compared byte for byte. That includes index.live, so a figure copied from anywhere else
#     fails here.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
# shellcheck source=scripts/poc-src.sh
source "$ROOT/scripts/poc-src.sh"
ensure_poc_src || exit 1

B="$ROOT/public/evals"
[ -d "$B" ] || { echo "FAIL: $B does not exist" >&2; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git -C "$MAIN" archive "$POC_REF" poc/data poc/config | tar -x -C "$TMP"
SRC="$TMP/poc/data"

failures=0
fail() { echo "FAIL: $*" >&2; failures=$((failures + 1)); }

# Same bytes, where a .jsonl on poc ships as .jsonl.gz.
same_trace() { # <poc file> <bundle dir> <label>
  local f="$1" dir="$2" label="$3" name shipped
  name="$(basename "$f")"
  case "$name" in
    *.jsonl.gz) shipped="$dir/$name"; [ -f "$shipped" ] || { fail "$label: missing $shipped"; return; }
      cmp -s "$f" "$shipped" || fail "$label: $shipped differs from poc" ;;
    *.jsonl) shipped="$dir/$name.gz"; [ -f "$shipped" ] || { fail "$label: missing $shipped"; return; }
      gunzip -c "$shipped" | cmp -s "$f" - || fail "$label: $shipped does not gunzip to poc's $name" ;;
  esac
}

# ── suites ──
arenas=0
for d in "$SRC"/evals/*/; do
  a="$(basename "$d")"
  arenas=$((arenas + 1))
  S="$B/suites/$a"
  [ -d "$S" ] || { fail "suite $a: missing $S"; continue; }
  [ -f "$S/runs.jsonl.gz" ] || { fail "suite $a: missing runs.jsonl.gz"; continue; }
  want=$(find "$d/runs" -name '*.json' | wc -l | tr -d ' ')
  got=$(gunzip -c "$S/runs.jsonl.gz" | grep -c . || true)
  [ "$want" = "$got" ] || fail "suite $a: runs.jsonl.gz has $got runs, poc has $want"
  for t in "$d"/traces/*; do same_trace "$t" "$S/traces" "suite $a"; done
  want=$(find "$d/traces" -type f | wc -l | tr -d ' ')
  got=$(find "$S/traces" -type f | wc -l | tr -d ' ')
  [ "$want" = "$got" ] || fail "suite $a: $got trace files shipped, poc has $want"
  echo "suite $a: runs $(gunzip -c "$S/runs.jsonl.gz" | grep -c .), traces $got"
done
[ "$arenas" -gt 0 ] || fail "no suites found under poc:poc/data/evals"
shipped_suites=$(find "$B/suites" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
[ "$shipped_suites" = "$arenas" ] || fail "bundle has $shipped_suites suites, poc has $arenas"

# Every run record equals the POC's file, by id (superseded ones carry one extra flag).
node - "$SRC" "$B" <<'JS' || fail "run records differ from poc (see above)"
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const [src, b] = process.argv.slice(2);
let bad = 0;
for (const a of fs.readdirSync(path.join(src, "evals"))) {
  const gz = path.join(b, "suites", a, "runs.jsonl.gz");
  if (!fs.existsSync(gz)) continue;
  const shipped = new Map(zlib.gunzipSync(fs.readFileSync(gz)).toString("utf8").split("\n").filter((l) => l.trim()).map((l) => {
    const r = JSON.parse(l);
    if (r.superseded === true) delete r.superseded;
    return [r.id, JSON.stringify(r)];
  }));
  for (const f of fs.readdirSync(path.join(src, "evals", a, "runs"))) {
    const raw = JSON.stringify(JSON.parse(fs.readFileSync(path.join(src, "evals", a, "runs", f), "utf8")));
    const id = f.replace(/\.json$/, "");
    if (!shipped.has(id)) { console.error(`FAIL: suite ${a}: run ${id} missing from runs.jsonl.gz`); bad++; }
    else if (shipped.get(id) !== raw) { console.error(`FAIL: suite ${a}: run ${id} differs from poc`); bad++; }
  }
}
process.exit(bad ? 1 : 0);
JS

# ── user-view ──
UV="$B/user-view"
for f in "$SRC"/user-view/runs/*.json; do
  cmp -s "$f" "$UV/runs/$(basename "$f")" || fail "user-view: runs/$(basename "$f") missing or differs from poc"
done
for t in "$SRC"/user-view/traces/*; do same_trace "$t" "$UV/traces" "user-view"; done
want=$(find "$SRC/user-view/runs" -name '*.json' | wc -l | tr -d ' ')
got=$(find "$UV/runs" -name '*.json' | wc -l | tr -d ' ')
[ "$want" = "$got" ] || fail "user-view: $got runs shipped, poc has $want"
listed=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).length)' "$UV/index.json" 2>/dev/null || echo missing)
[ "$listed" = "$want" ] || fail "user-view/index.json lists $listed runs, poc has $want"
echo "user-view: runs $got, traces $(find "$UV/traces" -type f | wc -l | tr -d ' ')"

# ── iterations ──
its=0
for d in "$SRC"/iterations/*/; do
  i="$(basename "$d")"
  its=$((its + 1))
  [ -f "$B/iterations/$i/iteration.json" ] || fail "iteration $i: missing iterations/$i/iteration.json"
  while IFS= read -r f; do
    rel="${f#"$d"}"
    cmp -s "$f" "$B/iterations/$i/$rel" || fail "iteration $i: $rel missing or differs from poc"
  done < <(find "$d" -type f)
done
echo "iterations: $its"

# ── config ──
diff -r "$TMP/poc/config" "$B/config" >/dev/null || fail "config/ differs from poc/config"

# ── recompute index.json & co. with the POC's suiteReport over the shipped bundle ──
VERCEL_AI_GATEWAY_API_KEY=offline-no-model-calls AI_GATEWAY_API_KEY=offline-no-model-calls \
  "$TSX" "$ROOT/scripts/build-eval-index.mts" --bundle "$B" --poc "$POC" --commit "$POC_REF" --check ||
  fail "index recompute (see above)"

if [ "$failures" -gt 0 ]; then
  echo "verify-eval-bundle: $failures failure(s)" >&2
  exit 1
fi
echo "verify-eval-bundle: OK ($arenas suites, $want user-view runs, $its iterations)"
