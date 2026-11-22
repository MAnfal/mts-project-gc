#!/usr/bin/env bash
# Chunk 03: every contract test fails against a plausible wrong implementation, and passes again once it's undone.
#
# Each mutation: copy the file aside, apply one perl substitution, check it actually changed the file, run the test
# file that guards the contract and require it to FAIL, copy the original back (never git checkout: the chunk's work
# may be uncommitted), prove the restore with cmp, and require the test file to PASS again.
# Usage: bash plans/2026-11-22-demo-build/03-pipeline/mutations.sh [name-filter]
# Logs are full vitest output; the committed evidence/mutations/*.txt keep only the FAIL, assertion and count lines.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
ONLY=${1:-}
BACKUP=$(mktemp -d)
LOG_DIR=${MUTATION_LOG_DIR:-$BACKUP}
fail() { echo "FAIL: $*" >&2; exit 1; }

mutate() { # name file perl-substitution test-file
  local name=$1 file=$2 sub=$3 test=$4
  [ -n "$ONLY" ] && [[ "$name" != *"$ONLY"* ]] && return 0
  cp "$file" "$BACKUP/orig"
  perl -0pi -e "$sub" "$file"
  if cmp -s "$BACKUP/orig" "$file"; then cp "$BACKUP/orig" "$file"; fail "$name: substitution matched nothing in $file"; fi
  local red=0
  pnpm exec vitest run "$test" >"$LOG_DIR/$name.red.txt" 2>&1 || red=1
  cp "$BACKUP/orig" "$file"
  cmp -s "$BACKUP/orig" "$file" || fail "$name: restore of $file failed"
  [ "$red" -eq 1 ] || fail "$name: $test still passes with the mutation applied"
  pnpm exec vitest run "$test" >"$LOG_DIR/$name.green.txt" 2>&1 || fail "$name: $test fails after restoring $file"
  echo "red→green  $name  ($(grep -a -m1 -E '^\s+Tests ' "$LOG_DIR/$name.red.txt" | xargs) | restored: $(grep -a -m1 -E '^\s+Tests ' "$LOG_DIR/$name.green.txt" | xargs))"
  grep -a -E '^ FAIL ' "$LOG_DIR/$name.red.txt" | sed 's/^/    /' | head -4
}

# The plan's parity mutation: the relevance cut, >= → >. Recorded docs sit exactly at the threshold.
mutate cut-ge-to-gt src/lib/pipeline/run.ts 's/\?\? 0\) >= cfg\.jevThreshold/?? 0) > cfg.jevThreshold/' src/lib/pipeline/replay.test.ts
# A port that drops the passages stage: the filter sees abstracts only.
mutate drop-passages src/lib/pipeline/run.ts 's/passages = await filterPassages\(ctx, profile, toLlm, probs\)/passages = undefined/' src/lib/pipeline/replay.test.ts
# A port that loses the setup's prompt set (strict): every prompt reverts to the defaults.
mutate drop-prompt-set src/lib/pipeline/run.ts 's/withPromptSet\(config\.promptSet,/withPromptSet(undefined,/' src/lib/pipeline/replay.test.ts
# The POC's reason fallback, the leak this chunk fixes.
mutate poc-reason-fallback src/lib/pipeline/stages.ts 's/\? NEUTRAL_REASON :/? `Jev p=\${dec.jevProbability.toFixed(2)} (no LLM reason)` :/' src/lib/pipeline/reason.test.ts
# A sanitizer that checks nothing.
mutate noop-assertPublic src/lib/pipeline/events.ts 's/(export function assertPublic\(event: RunEvent\): void \{)/$1\n  return;/' src/lib/pipeline/events.test.ts
# Raw stage ids as step labels (what a naive port emits).
mutate internal-labels src/lib/pipeline/context.ts 's/const step = stepOf\(name, this\.company\);/const step = { ...stepOf(name, this.company), label: name };/' src/lib/pipeline/events.test.ts
# A wrapper that never retries.
mutate no-retry src/lib/pipeline/retry.ts 's/if \(attempt >= policy\.attempts \|\| stopped\(\)\)/if (true)/' src/lib/pipeline/retry.test.ts
# Back-off waits swapped.
mutate wrong-delays src/lib/pipeline/retry.ts 's/delaysMs: \[2000, 4000\]/delaysMs: [4000, 2000]/' src/lib/pipeline/retry.test.ts
# A wrapper that swallows the final error: the run carries on to later stages.
mutate swallow-exhaustion src/lib/pipeline/retry.ts 's/throw new RetriesExhausted\(attempt, error\);/return undefined as T;/' src/lib/pipeline/retry.test.ts
# No gate after the terminal event: parallel failures each report.
mutate no-terminal-gate src/lib/pipeline/context.ts 's/if \(this\.ended\) return;//' src/lib/pipeline/retry.test.ts
# The error's own text as the failure message.
mutate raw-error-message src/lib/pipeline/run.ts 's/const message = rootCause\(e\) instanceof RetriesExhausted \? TIMEOUT_MESSAGE : UNEXPECTED_MESSAGE;/const message = String((rootCause(e) as Error)?.message);/' src/lib/pipeline/retry.test.ts
# Queued calls keep starting after the run failed.
mutate no-stop-after-failure src/lib/pipeline/context.ts 's/if \(this\.failed\) throw new Error\("run already failed"\);//; s/readonly stopped = \(\) => this\.failed;/readonly stopped = () => false;/' src/lib/pipeline/stages.test.ts
# Federal Register 5xx treated as an answer: no retry.
mutate no-http-retry src/lib/fr.ts 's/if \(res\.status >= 500 \|\| res\.status === 429\)/if (false)/' src/lib/fr.test.ts
# A missing key checked at import (the POC's behaviour).
mutate key-at-import src/lib/gateway.ts 's/(let gw: ReturnType<typeof createGateway> \| undefined;)/$1\nif (!process.env.AI_GATEWAY_API_KEY) throw new Error("Missing key");/' src/lib/gateway.test.ts
# The filter's missing-answer retry dropped.
mutate no-filter-retry src/lib/pipeline/stages.ts 's/attempt < 2 && pending\.length/attempt < 1 \&\& pending.length/' src/lib/pipeline/stages.test.ts
# The internal trace always printed to the server log.
mutate debug-always-on src/lib/pipeline/context.ts 's/if \(process\.env\.DEBUG_PIPELINE\) console\.debug/if (true) console.debug/' src/lib/pipeline/stages.test.ts
# A retry reported with no step running (an event with no step).
mutate retry-without-step src/lib/pipeline/context.ts 's/if \(this\.current\) this\.emit\(\{ type: "step\.retry", step: this\.current\.step,/this.emit({ type: "step.retry", step: this.current?.step as never,/' src/lib/pipeline/retry.test.ts
# run.start emitted outside the failure handling: a leak there escapes as a raw error with no run.failed.
mutate start-outside-try src/lib/pipeline/run.ts 's/(  try \{\n)(    ctx\.emit\(\{\n      type: "run\.start",[\s\S]*?\n    \}\);\n)/$2$1/' src/lib/pipeline/stages.test.ts

echo "mutations: OK (logs in $LOG_DIR)"
