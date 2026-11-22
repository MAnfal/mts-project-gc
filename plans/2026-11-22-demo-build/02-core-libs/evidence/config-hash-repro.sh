#!/usr/bin/env bash
# Reproduces evidence/config-hashes.tsv: the ported configHash() run over the POC's config and each
# step towards this repo's config/. Reads the POC with `git archive` (nothing under poc/ is staged),
# runs a throwaway vitest file under src/lib (removed on exit) and prints the table.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
T=$(mktemp -d)
PROBE=src/lib/zz-hash-repro.test.ts
trap 'rm -rf "$T" "$PROBE"' EXIT

git archive poc poc/config | tar -x -C "$T"
mkdir -p "$T/v"
cp -R "$T/poc/config" "$T/v/a-poc"
cp -R "$T/v/a-poc" "$T/v/b-poc+brightside"; cp config/companies/brightside.yaml "$T/v/b-poc+brightside/companies/"
cp -R "$T/v/b-poc+brightside" "$T/v/c-poc+brightside+app"; cp config/app.yaml "$T/v/c-poc+brightside+app/"
cp -R "$T/v/a-poc" "$T/v/d-poc+app"; cp config/app.yaml "$T/v/d-poc+app/"
diff -r "$T/v/c-poc+brightside+app" config >/dev/null || { echo "FAIL: variant c is not this repo's config/" >&2; exit 1; }

cat > "$PROBE" <<EOF
import fs from "node:fs";
import { it } from "vitest";
import { configHash } from "./config";
it("hashes each variant", () => {
  const base = "$T/v";
  const rows = fs.readdirSync(base).sort().map((d) => d + "\t" + configHash(base + "/" + d));
  rows.push("repo config/\t" + configHash());
  fs.writeFileSync("$T/hashes.tsv", rows.join("\n") + "\n");
});
EOF
pnpm exec vitest run "$PROBE" >/dev/null
cat "$T/hashes.tsv"
