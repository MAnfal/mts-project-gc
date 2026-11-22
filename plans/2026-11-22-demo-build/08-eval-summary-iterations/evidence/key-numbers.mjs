// Emits the completion report's key numbers from public/evals/index.json (run: node <this file>).
import fs from "node:fs";
const idx = JSON.parse(fs.readFileSync("public/evals/index.json", "utf8"));
const pct = (v) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
const lab = (n) => `${n.split} · ${n.runs} runs · ${n.suite.map((s) => s.split("-").at(-1)).join("+")}`;
const ag = (n) => `${n.numerator}/${n.denominator} = ${pct(n.value)} (${lab(n)})`;
const { live: L, baseline: B, noiseBand: nb, evalSet: es } = idx;
const out = [];
for (const m of ["recall", "precision", "datesRight", "costPerRunUsd"])
  out.push(`${m}: live all ${m === "costPerRunUsd" ? L[m].all.value.toFixed(4) : pct(L[m].all.value)} (${lab(L[m].all)}); live test ${m === "costPerRunUsd" ? L[m].test.value.toFixed(4) : pct(L[m].test.value)} (${lab(L[m].test)}); baseline ${m === "costPerRunUsd" ? B[m].all.value.toFixed(4) : pct(B[m].all.value)} (${lab(B[m].all)})`);
for (const m of ["relevanceAgreement", "tierAgreement"]) out.push(`${m}: live all ${ag(L[m].all)}; live test ${ag(L[m].test)}; baseline ${ag(B[m].all)}`);
out.push(`noiseBand: control ${nb.setup} in ${nb.suites.join(" vs ")}: recall ${nb.measures.recall.values.map((v) => v.toFixed(4)).join(" vs ")} → ${(nb.measures.recall.value * 100).toFixed(2)} pts; precision ${nb.measures.precision.values.map((v) => v.toFixed(4)).join(" vs ")} → ${(nb.measures.precision.value * 100).toFixed(2)} pts (runs ${nb.measures.recall.runs.join("/")})`);
const it = idx.iterations.find((i) => i.setup === L.setup);
const c = it.measured.candidate, p = it.measured.comparedTo;
for (const m of ["recall", "precision", "datesRight"]) out.push(`06 vs control (${it.suite.split("-").at(-1)}): ${m} ${pct(c[m].all.value)} vs ${pct(p[m].all.value)} → gap ${((c[m].all.value - p[m].all.value) * 100).toFixed(2)} pts vs band ${(nb.measures[m].value * 100).toFixed(2)} pts (${c[m].all.runs}/${p[m].all.runs} runs)`);
out.push(`06 cost change: ${(((c.costPerRunUsd.all.value - p.costPerRunUsd.all.value) / p.costPerRunUsd.all.value) * 100).toFixed(1)}%`);
out.push(`evalSet: ${JSON.stringify(es)}`);
console.log(out.join("\n"));
