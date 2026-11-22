# Sourced by build-eval-bundle.sh and verify-eval-bundle.sh. Provides a read-only checkout of the `poc`
# branch, so the eval bundle is built and checked with the POC's own code.
#
# Sets: MAIN (the main checkout), POC_REF (`poc`'s commit), POC_WT (the POC worktree), POC (its poc/ dir),
# TSX (the POC's own tsx). The worktree lives at <main checkout>/.worktrees/poc-src, outside every chunk
# worktree, so no poc/ path can ever be staged in this repository's branches. It is checked out detached;
# nothing is ever committed in it.
#
# Fails, rather than repairing anything, if the worktree is at a different commit than `poc` or has edits
# to tracked files: the grading code that runs must be the POC's, unmodified.

MAIN="$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)"
POC_REF="$(git -C "$MAIN" rev-parse --verify poc^{commit})"
POC_WT="$MAIN/.worktrees/poc-src"
POC="$POC_WT/poc"
TSX="$POC/node_modules/.bin/tsx"

ensure_poc_src() {
  if [ ! -d "$POC_WT" ]; then
    git -C "$MAIN" worktree add --detach "$POC_WT" poc >&2
  fi
  local head
  head="$(git -C "$POC_WT" rev-parse HEAD)"
  if [ "$head" != "$POC_REF" ]; then
    echo "FAIL: $POC_WT is at $head but poc is at $POC_REF. Run: git -C $POC_WT checkout --detach poc" >&2
    return 1
  fi
  if [ -n "$(git -C "$POC_WT" status --porcelain --untracked-files=no)" ]; then
    echo "FAIL: $POC_WT has edits to tracked files; the POC code must run unmodified." >&2
    git -C "$POC_WT" status --short --untracked-files=no >&2
    return 1
  fi
  (cd "$POC" && pnpm install --frozen-lockfile --silent) >&2
}
