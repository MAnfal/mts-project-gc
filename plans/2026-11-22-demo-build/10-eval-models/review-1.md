# Chunk 10 review, iteration 1 (tip f047b69): FAIL

Scratch: /private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/review-10-i1b/

## Observed (by the reviewer)
- git status clean at start and end. Gate block (PORT=3711): exit 0, 47 files / 646 tests, no-typed-numbers OK, verify-eval-bundle OK, poc tree 0 / history 0 (gates.out).
- Keyless `pnpm start -p 3712`: /evals/models 200. 390 px: scrollWidth 390; one table 1091 in a 340 px overflow-x:auto box. 1440 px: 1145/1145. Five row links are `a` to /evals/cases?suite=...&setup=<key>. Clicking jev-gpt at 390 px opens "Cases for jev-gpt in w0i" (2 still missed, 12 traps, 93 cases), scrollWidth 390.
- Cases states live: unknown setup (l92 + jev-gpt) lists l92's setups; unknown suite; suite alone lists setups; iteration + suite -> iteration 06 with precedence note; ?setup= alone -> note.
- Numbers on the page match index.json: jev-sonnet recall 0.97619, precision 0.48810, cost 0.15887; jev-gpt 0.85714, 0.50704, 0.10254; baseline recall 0.71429; 18 runs each; judge runs 6 (of 6 company-weeks).
- Mutations (restored, cmp clean): drop pipeline filter in lowestRecall -> 4 red; live = setup key -> many red; drop setup-in-suite check -> 1 red; iteration-doesn't-win -> 1 red.

## Issues
1. Silent drop (rubric guard item). modelComparisons builds rows only from suiteResults. A setup listed in suites[].setups with no suiteResults entry vanishes with no error and no exclusion note. Reproduced: removing jev-gpt's w0i result from index.json makes w0i "single model, no comparison" with no message (drop.mts). No test covers it (models.test.ts guards only: missing from index.setups, single model, pooled). SuiteGroup also prints "runs over {suite.setups.length} setups" while the table shows fewer rows. Fix at the boundary: throw (or exclude with a stated reason) when a suite setup has no result, plus a constructed-input test, mutation-checked.
2. Price-parity date (rubric caveats (b)). The page states parity with no date. The rubric requires the date taken from a recorded source. A recorded source exists in the bundle: public/evals/config/setups.yaml line 2 ("checked 2026-11-21"), though only as a YAML comment. The lead ruled the date out; the rubric still says otherwise, so this FAILs as written unless the lead amends the rubric item.

## Warnings
- ModelTable null metric: the "—" mark lives in the existing `Value`; no test renders a null cell in this table (compareRows/lowestRecall null cases are tested at the pure layer).
- Key-bias `holds` text says "the only one on a non-Claude model"; `onlyOtherVendor` is true when two other-vendor setups tie lowest, which reads wrong.
- `liveRule` ("came later and never ran beside another model") and the table footnote (judges judged only the first repeat; cost over every run, time over finished runs) are typed claims about the shipped data, true now (live setup ran only in 27v, l92, du8, all Sonnet-only; judge runs 6 of 18) but not computed.
- w0i is one 2-week, 6-company-week suite; the POC README says single-suite gaps of that size can sit inside the control's A/A swing. The rationale says "Why Sonnet" from an 11.9-point recall gap with no noise caveat (the report records it as a judgment call).
- Typed claim "It grades the wording of every setup's actions alike" (judges sentence) rests on judges.yaml comments, not data.
- project.md configHash `fca03a3b9f` could not be re-measured by the reviewer (config.ts imports server-only under tsx); unverified.
- Rubric (b) text vs. lead ruling is a contract question for the lead, not widened here.

## Lead conclusions tested
1. Rationale: true. Recall 97.6 vs 85.7 higher on Sonnet, precision 1.9 pts lower, cost $0.056 higher; no iteration notes or POC README prose explains a model choice (grep of public/evals/iterations; README read).
2. Key-bias caveat: computed (`onlyOtherVendor`), names pipeline setups and names the baseline as excluded; jev-gpt lowest 85.7, baseline 71.4 lower and excluded. True as stated.
3. 390 px: verified in a browser (above).
4. casesState: iteration + suite precedence, unknown suite, setup not in suite each tested and mutation-red. RunPanel and src/components/shell unchanged (git diff --stat empty). 

## Guidance
Fix Issue 1 first (guard + test + mutation), then get the lead's call on Issue 2 (add the date from setups.yaml via a parsed source, or amend the rubric).
