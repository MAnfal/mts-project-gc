# Chunk 08 review, iteration 1: PASS (with warnings)

Reviewed at HEAD 4a0a1f1, tree clean before and after. Gates re-run by the reviewer on that tree: lint 0 problems;
vitest 25 files / 283 tests; build ok (/evals and /evals/iterations/[id] are dynamic); no-typed-numbers OK;
03 gates OK; verify-eval-bundle OK (9 suites, 22 user-view runs, 8 iterations); parity OK; no-fs-writes OK;
typecheck OK. `bash scripts/build-eval-bundle.sh` then `git status --short` empty. No `poc/` in HEAD tree or
branch history (0 and 0). No src/components/shell change.

## Lead observations, tested
1. Rendered under `pnpm start -p 3812` in headless Chromium: scrollWidth == clientWidth at 1280 and at 390 for
   /evals, 00, 03, 06, 07 (and 1280 for an unknown id, which shows "No such iteration").
2. Context numbers: keys give 12 sets, 20 relevant, 157 traps (recomputed from poc-src keys) = `index.evalSet`.
   "6 changes" = measured iterations with a comparedTo (data). "3 were kept" = those whose YAML `outcome` is
   kept/promoted (01, 02, 06): a count over data, with the outcome labels hand-set in config/eval-story.yaml.
   No digit is typed (EvalStorySchema rejects them). The shell gate only needles 89.8|81.5|72.6|63%|$0.52: a
   planted "89.8%" in CarlTable.tsx fails it (rc=1), a planted bare "157" or "6 changes" would not.
3. Noise wording: /evals shows no 06 verdict; iteration-06 says recall "within noise" (+1.0 vs band 4.1) and
   precision "beyond noise" (+2.7 vs 2.1), computed by `noiseVerdict` (strict <). Consistent with Decision 10.
4. Agreement reproduced independently from raw POC runs and keys (python, not the repo code): live 335/354
   relevance, 40/40 tier over 69 runs / 24 groups; baseline 160/177 = 0.904 and 7/10 = 0.70 over 36 runs.
   Matches index.json exactly.
5. Screenshots committed: the rubric asks for them in the report; fine.

Own mutations (each restored): near band widened; noiseVerdict `<=`; relevance drops the "none flagged" case;
tier checks `some` instead of `every`; cost direction ignored. All five went red in named tests.
configHash c017e8bc89 in project.md reproduced by running `configHash()`.

## Warnings
- recharts 3.8.0 (read from node_modules) is not in project.md Stack, nor the shadcn components added. The
  report hands this to the lead; it must land before merge or the rubric item stays open.
- Page shows two noise statements for 06: computed "precision beyond noise" (2-suite band) next to the recorded
  decision's "gap inside the control's A/A band" (4-suite band). The report explains it; the page does not.
- Gate 2 needles are the mockup's five figures only; a typed `20`, `157` or `6` in a component is not caught.
- `EvalAppConfigSchema` is a second export in schemas.ts beyond the evalTargets block (rubric: that block is the
  only change). Small and justified in the report.
- `bg-stone-50` (DiffSheet.tsx:25, ErrorAnalysisSheet.tsx:43) is a raw palette class, not a theme token.
- 03 page heading says "Result against the setup it replaced" for a rejected iteration.
