#!/usr/bin/env bash
# Makes a fresh checkout or worktree able to run the gates: installs dependencies and provides
# .env.local with AI_GATEWAY_API_KEY. Run from the repository root: bash scripts/bootstrap.sh
#
# Key source, first match wins (the key's value is never printed):
#   1. .env.local already present here       -> left alone
#   2. <main checkout>/.env.local            -> symlinked
#   3. <main checkout>/.env                  -> AI_GATEWAY_API_KEY (or the POC's VERCEL_AI_GATEWAY_API_KEY,
#                                               renamed) copied into a new .env.local, mode 600
# With no key found it warns and continues: install, lint, tests and build need no key.
set -euo pipefail

pnpm install --frozen-lockfile

here=$(pwd -P)
main=$(cd "$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")" && pwd -P)

if [ -e .env.local ] || [ -L .env.local ]; then
  echo "bootstrap: .env.local already present"
elif [ "$main" != "$here" ] && [ -f "$main/.env.local" ]; then
  ln -s "$main/.env.local" .env.local
  echo "bootstrap: symlinked .env.local -> $main/.env.local"
elif [ -f "$main/.env" ] && grep -qE '^(VERCEL_)?AI_GATEWAY_API_KEY=' "$main/.env"; then
  umask 077
  # Prefer the AI SDK's own name; fall back to the POC's, renamed. Only the first match is kept.
  { grep -E '^AI_GATEWAY_API_KEY=' "$main/.env" \
    || sed -n 's/^VERCEL_AI_GATEWAY_API_KEY=/AI_GATEWAY_API_KEY=/p' "$main/.env"; } | head -n 1 > .env.local
  echo "bootstrap: wrote AI_GATEWAY_API_KEY to .env.local from $main/.env"
else
  echo "bootstrap: WARNING no AI_GATEWAY_API_KEY found; live model calls will fail until .env.local sets it" >&2
fi
