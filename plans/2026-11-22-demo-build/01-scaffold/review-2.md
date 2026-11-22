# Chunk 01 review, iteration 2: PASS (tip 7f327e8)

Observed by me, not taken from the report:
- `PORT=3112 bash gates.sh all` exit 0 (22/22 tests, build `ƒ /`, `ƒ /api/probe/stream`, gates 2-4 OK, 0 warn/error lines). Nothing left on 3112. Run twice; the second run is after the final tree state (clean `git status`).
- No `poc/` path in HEAD tree or in `feat/plan--demo-build..HEAD` (both greps empty). No `.env*` tracked; no key value in the diff.
- Iteration-1 fixes, mutated in a scratch copy (`scratchpad/review-01-i2/m`): dropping the `(root)` fallback fails 2 named tests; removing the upper clamp fails `seconds=500` and the sweep; removing the lower clamp fails `seconds=0`, `-3` and the sweep; returning MIN instead of the default on parse failure fails `abc`, `Infinity`, `-Infinity`, `1e999`. `.refine(Number.isFinite)` is gone; the Infinity cases pin zod's behaviour.
- 390 px (Chrome headless via CDP, `pnpm start`): scrollWidth == clientWidth == 390, NAV/MAIN/ASIDE stacked (tops 8/221/604, width 374), no element right edge past the viewport. Also 320 px (no overflow) and 1440 px (220 / 907 / 280 px panes). main bg rgb(254,254,255), radius 12px, xs shadow, Inter, config value "7 days". Lead's observation holds.
- No fs writes in src/scripts; no raw hex/rgb in .tsx; no clickable divs; no form controls or icon-only buttons exist; Inter via next/font; globals tokens match gcai-ui-notes; CLAUDE.md diff is the one harness line; Principles text untouched except the status line.

Process note: while preparing scratch mutations I mutated `load.ts` and `seconds.ts` in the worktree by mistake (shell glob error broke my `&&` chain). I restored both with `git checkout --` (tree clean) and re-ran all gates afterwards.

## Warnings (non-blocking)
- completion-report Appendix still shows the 17-test counts; it labels them as pre-iteration-1, so it is honest but stale.
- `maxDuration` test cannot fail against a wrong implementation in the red run (report admits it); regression guard only.
- Page uses a plain `<a>` for the probe link (an API route, so correct) but `next/link` is used elsewhere; harmless.
