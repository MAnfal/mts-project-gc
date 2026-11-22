import subprocess, os, re, json, sys
ROOT='/Users/anfal/Projects/hobby_projects/gc-ai-swe-take-home/.worktrees/08-eval-summary'
OUT='/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-08/mut'
M=[
 ("splitOfEvalset: unknown eval set not reported", "src/lib/evals/bundle-build.ts", '  if (!split) throw new Error(`eval set ${id} is not in the manifest`);\n  return split;', '  return split as "dev";', "src/lib/evals/bundle-build.test.ts"),
 ("iterationRuns: missing setup/suite not reported", "src/lib/evals/bundle-build.ts", '  if (!it.setup || !it.suite) throw new Error(`iteration ${it.id} has no setup or suite`);\n  return { setup: it.setup, comparedTo: it.comparedTo, suite: it.suite };', '  return { setup: it.setup ?? "", comparedTo: it.comparedTo, suite: it.suite ?? "" };', "src/lib/evals/bundle-build.test.ts"),
 ("iterationRuns: evidence-only iteration measured", "src/lib/evals/bundle-build.ts", '  if (it.evidenceOnly) return null;\n  if (!it.setup', '  if (!it.setup', "src/lib/evals/bundle-build.test.ts"),
 ("requireKeys: missing keys not reported", "src/lib/evals/bundle-build.ts", '  if (missing.length) throw new Error(`no answer key for eval sets: ${missing.join(", ")}`);\n', '', "src/lib/evals/bundle-build.test.ts"),
 ("bandControl: first instead of last live iteration", "src/lib/evals/bundle-build.ts", 'return iterations.findLast((i) => i.setup === liveSetup)?.comparedTo ?? null;', 'return iterations.find((i) => i.setup === liveSetup)?.comparedTo ?? null;', "src/lib/evals/bundle-build.test.ts"),
 ("story: miss sentence without run count", "src/lib/evals/story.ts", '          runs: String(t.value.runs),\n', '', "src/lib/evals/story.test.ts"),

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
with open(os.path.join(OUT,'summary-round2.md'),'w') as o:
    for x in res:
        if len(x)==3: o.write(f"- {x[0]}: {x[1]} ({x[2]})\n"); continue
        name,f,rc,failed,summ=x
        o.write(f"- **{name}** (`{f}`) → exit {rc}; {summ[0] if summ else ''}; red: {'; '.join(failed) if failed else 'NONE'}\n")
print(open(os.path.join(OUT,'summary-round2.md')).read())
