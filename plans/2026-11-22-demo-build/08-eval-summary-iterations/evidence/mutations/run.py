import subprocess, os, re, json, sys
ROOT='/Users/anfal/Projects/hobby_projects/gc-ai-swe-take-home/.worktrees/08-eval-summary'
OUT='/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-08/mut'
M=[
 ("verdict: hard-coded met count (5)", "src/lib/evals/verdict.ts", 'met: graded.filter((t) => t.status === "met").length,', 'met: 5,', "src/lib/evals/verdict.test.ts"),
 ("verdict: no tolerance for an exactly-met target", "src/lib/evals/verdict.ts", 'if (value >= min - EPS) return "met";', 'if (value > min) return "met";', "src/lib/evals/verdict.test.ts"),
 ("verdict: a measure the baseline lacks counted as a win", "src/lib/evals/verdict.ts", 'excluded.push(m);\n      continue;', 'comparisons.push({ measure: m, live: live!, baseline: baseline ?? live!, outcome: "win" });\n      continue;', "src/lib/evals/verdict.test.ts"),
 ("verdict: beats-all ignores an empty comparison", "src/lib/evals/verdict.ts", 'const beatsAll = comparisons.length > 0 && wins === comparisons.length;', 'const beatsAll = wins === comparisons.length;', "src/lib/evals/verdict.test.ts"),
 ("story: unknown placeholder left in place", "src/lib/evals/story.ts", 'if (!(name in ctx)) throw new Error(`Unknown placeholder {{${name}}} in "${template}"`);', 'if (!(name in ctx)) return "";', "src/lib/evals/story.test.ts"),
 ("story: unclosed placeholder printed", "src/lib/evals/story.ts", '  if (out.includes("{{")) throw new Error(`Unclosed placeholder in "${template}"`);\n', '', "src/lib/evals/story.test.ts"),
 ("story: ambiguous quote start accepted", "src/lib/evals/story.ts", '  if (count > 1) throw', '  if (count > 99) throw', "src/lib/evals/story.test.ts"),
 ("story: missing quote end runs to end of text", "src/lib/evals/story.ts", '    if (end < 0) throw new Error(`quote end "${q.before}" does not follow "${q.start}" in the recorded ${q.from}`);', '    if (end < 0) end = text.length;', "src/lib/evals/story.test.ts"),
 ("story: missing record field", "src/lib/evals/story.ts", '  if (typeof text !== "string") throw new Error(`no recorded ${q.from} to quote from`);\n', '', "src/lib/evals/story.test.ts"),
 ("chartSeries: one continuous series across the eval-set change", "src/lib/evals/chartSeries.ts", 'prev.evalsets === evalsets ? prev.segment : prev.segment + 1', 'prev.segment', "src/lib/evals/chartSeries.test.ts"),
 ("chartSeries: constant band when the index has none", "src/lib/evals/chartSeries.ts", '  const nb = index.noiseBand;', '  const nb = index.noiseBand ?? ({ setup: "x", suites: ["a", "b"], measures: { recall: { value: 0.03 }, precision: { value: 0.03 } } } as unknown as NonNullable<EvalIndex["noiseBand"]>);', "src/lib/evals/chartSeries.test.ts"),
 ("chartSeries: iteration without a story entry skipped silently", "src/lib/evals/chartSeries.ts", '    if (!s) throw new Error(`iteration ${it.id} has no entry in config/eval-story.yaml`);', '    if (!s) continue;', "src/lib/evals/chartSeries.test.ts"),
 ("chartSeries: unknown suite skipped silently", "src/lib/evals/chartSeries.ts", '    if (evalsets === undefined) throw new Error(`iteration ${it.id} ran on suite ${it.suite}, which is not in index.json`);', '    if (evalsets === undefined) continue;', "src/lib/evals/chartSeries.test.ts"),
 ("noiseVerdict: a gap equal to the band called within noise", "src/lib/evals/chartSeries.ts", 'return Math.abs(gap) < band ? "within noise" : "beyond noise";', 'return Math.abs(gap) <= band ? "within noise" : "beyond noise";', "src/lib/evals/chartSeries.test.ts"),
 ("bandApplies: band applied to every suite", "src/lib/evals/chartSeries.ts", '  return size !== undefined && nb.suites.every((s) => evalsetCount(index, s) === size);', '  return size !== undefined;', "src/lib/evals/chartSeries.test.ts"),
 ("repeatAgreement: single-repeat groups counted as agreeing", "src/lib/evals/bundle-build.ts", '    if (reps.length < 2) continue;\n', '', "src/lib/evals/bundle-build.test.ts"),
 ("repeatAgreement: superseded runs counted", "src/lib/evals/bundle-build.ts", 'if (r.status !== "done" || r.superseded) continue;', 'if (r.status !== "done") continue;', "src/lib/evals/bundle-build.test.ts"),
 ("repeatAgreement: relevance agrees only when all repeats flag (none-flagged dropped)", "src/lib/evals/bundle-build.ts", 'if (n === 0 || n === reps.length) c.relevance.numerator++;', 'if (n === reps.length) c.relevance.numerator++;', "src/lib/evals/bundle-build.test.ts"),
 ("repeatAgreement: missing key not reported", "src/lib/evals/bundle-build.ts", '    if (!key) throw new Error(`no answer key for eval set ${evalset}`);\n', '    if (!key) continue;\n', "src/lib/evals/bundle-build.test.ts"),
 ("repeatAgreement: run with no arena/eval set not reported", "src/lib/evals/bundle-build.ts", '    if (!arena || !evalset) throw new Error(`run ${r.id} has no arena or eval set`);\n', '    if (!arena || !evalset) continue;\n', "src/lib/evals/bundle-build.test.ts"),
 ("metricOf: empty split not handled", "src/lib/evals/bundle-build.ts", '  if (!s) return { value: null, runs: 0 };\n', '', "src/lib/evals/bundle-build.test.ts"),
 ("noiseBand: missing suite not handled", "src/lib/evals/bundle-build.ts", '  if (!a || !b) return null;\n', '', "src/lib/evals/bundle-build.test.ts"),
 ("index-schema: agreement value not checked against numerator/denominator", "src/lib/evals/index-schema.ts", '    if (v.value !== want) ctx.addIssue', '    if (false) ctx.addIssue', "src/lib/evals/index-schema.test.ts"),
 ("story-schema: digits allowed in prose", "src/lib/evals/story-schema.ts", '.refine((s) => !/\\d/.test(s.replace(/\\{\\{[^}]*\\}\\}/g, "")), {', '.refine(() => true, {', "src/lib/evals/story-schema.test.ts"),
 ("config/eval-story.yaml: 07-next entry removed", "config/eval-story.yaml", '  07-next:\n    label: "Next"\n    outcome: next\n    moved: []\n', '', "src/lib/evals/story-schema.test.ts"),
 ("config/eval-story.yaml: quote anchor no longer in the record", "config/eval-story.yaml", 'start: "the targeted gain is"', 'start: "the targeted gains are"', "src/lib/evals/story-schema.test.ts"),
 ("config/app.yaml: precision target raised to 0.82 (heading must change)", "config/app.yaml", '  precision: 0.8\n', '  precision: 0.82\n', "src/lib/evals/story-schema.test.ts"),
]
res=[]
for name,f,old,new,test in M:
    p=os.path.join(ROOT,f); orig=open(p).read()
    if orig.count(old)!=1: res.append((name,'ANCHOR NOT UNIQUE',orig.count(old))); continue
    open(p,'w').write(orig.replace(old,new))
    try:
        r=subprocess.run(['pnpm','vitest','run',test],cwd=ROOT,capture_output=True,text=True)
        out=r.stdout+r.stderr
    finally:
        open(p,'w').write(orig)
    assert open(p).read()==orig
    failed=[re.sub(r'\s+\d+ms$','',l.strip()) for l in out.splitlines() if l.strip().startswith('×')]
    summ=[l.strip() for l in out.splitlines() if l.strip().startswith('Tests ')]
    res.append((name,f,r.returncode,failed,summ))
    open(os.path.join(OUT,re.sub(r'\W+','_',name)[:60]+'.txt'),'w').write(out)
with open(os.path.join(OUT,'summary.md'),'w') as o:
    for x in res:
        if len(x)==3: o.write(f"- {x[0]}: {x[1]} ({x[2]})\n"); continue
        name,f,rc,failed,summ=x
        o.write(f"- **{name}** (`{f}`) → exit {rc}; {summ[0] if summ else ''}; red: {'; '.join(failed) if failed else 'NONE'}\n")
print(open(os.path.join(OUT,'summary.md')).read())
