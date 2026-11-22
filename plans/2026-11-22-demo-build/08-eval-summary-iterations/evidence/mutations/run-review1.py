import subprocess, os, re, json, sys
ROOT='/Users/anfal/Projects/hobby_projects/gc-ai-swe-take-home/.worktrees/08-eval-summary'
OUT='/private/tmp/claude-501/-Users-anfal-Projects-hobby-projects-gc-ai-swe-take-home/ddc2e56d-412d-41ac-a327-b31278844f2d/scratchpad/chunk-08/mut'
M=[
 ("story: 06 noise note removed", "config/eval-story.yaml", '    noiseNote: "The recorded decision below measured noise differently: the control\'s swing across all four of its identical-config suites, per eighteen runs. That wider band is why the decision calls the overall gains inside the noise, while this table, using only the two suites shown, puts the precision gap beyond it."\n', '', "src/lib/evals/story-schema.test.ts"),
 ("story-schema: noise note accepts typed numbers", "src/lib/evals/story-schema.ts", '    noiseNote: Prose.optional(),', '    noiseNote: z.string().optional(),', "src/lib/evals/story-schema.test.ts"),

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
with open(os.path.join(OUT,'summary-review1.md'),'w') as o:
    for x in res:
        if len(x)==3: o.write(f"- {x[0]}: {x[1]} ({x[2]})\n"); continue
        name,f,rc,failed,summ=x
        o.write(f"- **{name}** (`{f}`) → exit {rc}; {summ[0] if summ else ''}; red: {'; '.join(failed) if failed else 'NONE'}\n")
print(open(os.path.join(OUT,'summary-review1.md')).read())
