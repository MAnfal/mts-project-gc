import Link from "next/link";
import { connection } from "next/server";
import ProgressChart from "@/components/ProgressChart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { experiment } from "@/lib/config";
import { listIterations, type Iteration, type IterationMetrics } from "@/lib/iterations";

const pct = (x: number | null | undefined) => (x === null || x === undefined ? "—" : `${(x * 100).toFixed(1)}%`);
const delta = (a: number | null | undefined, b: number | null | undefined) => {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const d = (a - b) * 100;
  return <span className={d >= 0 ? "text-[var(--status-good)]" : "text-destructive"}>{d >= 0 ? "+" : ""}{d.toFixed(1)}</span>;
};

/** A unified diff with +/− lines coloured (plain <pre>, no library needed). */
function Diff({ text }: { text: string }) {
  return (
    <pre className="text-xs overflow-x-auto rounded-md border bg-muted/30 p-3 max-h-96">
      {text.split("\n").map((l, i) => (
        <div key={i} className={l.startsWith("+") && !l.startsWith("+++") ? "text-[var(--status-good)]" : l.startsWith("-") && !l.startsWith("---") ? "text-destructive" : l.startsWith("@@") ? "text-muted-foreground" : ""}>
          {l || " "}
        </div>
      ))}
    </pre>
  );
}

const ROWS: [keyof IterationMetrics, string][] = [
  ["recall", "Recall"],
  ["precision", "Precision"],
  ["trapAvoidance", "Traps avoided"],
  ["datesRight", "Dates right"],
  ["judgePass", "Judges: action OK"],
  ["consistency", "Same every run"],
];

function IterationCard({ it, gates }: { it: Iteration; gates: { recall: number; precision: number } }) {
  const c = it.results.candidate;
  const b = it.results.comparedTo;
  const meets = (c.recall ?? 0) >= gates.recall && (c.precision ?? 0) >= gates.precision;
  return (
    <Card id={it.id}>
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span className="font-mono">{it.id}</span> · {it.date} · suite{" "}
          <Link className="underline" href={`/arena/${it.suite}`}>{it.suite}</Link>
          {meets && <Badge className="ml-auto">meets both targets</Badge>}
        </CardDescription>
        <CardTitle>{it.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Hypothesis</div>
            <p>{it.hypothesis}</p>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Change</div>
            <p>{it.change}</p>
            {it.codeChanges && <p className="mt-1 text-muted-foreground">Code: {it.codeChanges}</p>}
            {it.evalChanges && <p className="mt-1 text-muted-foreground">Eval / grader: {it.evalChanges}</p>}
          </div>
        </div>

        {it.evidence && (
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Why — error analysis of the previous winner on dev weeks ({it.evidence.runs} runs{it.evidence.excludedTestRuns ? `; ${it.evidence.excludedTestRuns} test-week runs never read` : ""})
            </div>
            <div className="flex flex-wrap gap-1 mb-2">
              {it.evidence.buckets.map(([k, n]) => (
                <Badge key={k} variant="outline">{k} · {n}</Badge>
              ))}
            </div>
            {it.evidence.rootCauses && (
              <ul className="grid gap-1">
                {it.evidence.rootCauses.map((r, i) => (
                  <li key={i} className="rounded-md border p-2">
                    <Badge variant="secondary" className="mr-2">{r.whose}</Badge>
                    {r.cause} <span className="text-muted-foreground">({r.failures})</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Result</div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="text-left font-normal py-1">Metric</th>
                <th className="text-right font-normal">{c.label}</th>
                {b && <th className="text-right font-normal">vs {b.label}</th>}
                {b && <th className="text-right font-normal">Δ pts</th>}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(([k, l]) => (
                <tr key={k} className="border-b">
                  <td className="py-1">{l}</td>
                  <td className="text-right tabular-nums">{pct(c[k] as number | null)}</td>
                  {b && <td className="text-right tabular-nums text-muted-foreground">{pct(b[k] as number | null)}</td>}
                  {b && <td className="text-right tabular-nums">{delta(c[k] as number | null, b[k] as number | null)}</td>}
                </tr>
              ))}
              <tr className="border-b">
                <td className="py-1">Cases right: dev · test (held out)</td>
                <td className="text-right tabular-nums">{c.devCasesRight} · {c.testCasesRight}</td>
                {b && <td className="text-right tabular-nums text-muted-foreground">{b.devCasesRight} · {b.testCasesRight}</td>}
                {b && <td />}
              </tr>
              <tr>
                <td className="py-1">$ / run · time</td>
                <td className="text-right tabular-nums">${c.costPerRunUsd.toFixed(3)} · {c.secondsPerRun}s</td>
                {b && <td className="text-right tabular-nums text-muted-foreground">${b.costPerRunUsd.toFixed(3)} · {b.secondsPerRun}s</td>}
                {b && <td />}
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Decision</div>
          <p>{it.decision}</p>
          {it.notes && <p className="mt-1 text-muted-foreground">{it.notes}</p>}
          {it.regraded && <p className="mt-1 text-xs text-muted-foreground">{it.regraded}</p>}
        </div>

        {(it.systemDiff || it.configDiff) && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">
              What exactly changed{it.systemChanges?.length ? `: ${it.systemChanges.join(", ")}` : ""}
              {it.code ? ` · code @ ${it.code.commit}${it.code.uncommittedSrcChanges ? ` (+${it.code.uncommittedSrcChanges} uncommitted files)` : ""}` : ""}
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              {it.systemDiff && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">system.diff: effective config of {it.comparedTo} → {it.setup} (as recorded in their traces)</div>
                  <Diff text={it.systemDiff} />
                </div>
              )}
              {it.configDiff && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">config.diff: config/ vs the previous iteration&apos;s snapshot ({it.configChangesSincePrevious?.files.join(", ")})</div>
                  <Diff text={it.configDiff} />
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

/** How the evals evolved the system: every iteration, what changed, why, and what it did to precision and recall. */
export default async function ProgressPage() {
  await connection();
  const its = listIterations();
  const gates = experiment().evals.gates;
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">How the evals improved the system</h1>
        <p className="text-sm text-muted-foreground">
          Each iteration: error analysis of the previous winner on <b>dev</b> weeks only (code graders + trace checks + judge panel) → one change in config →
          re-run → kept only if it also holds on the held-out <b>test</b> weeks.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Precision and recall per iteration</CardTitle>
          <CardDescription>
            Dashed lines are the RFC targets. Each point is that iteration&apos;s <b>candidate</b>, not the live setup (only 02 was promoted).
            The eval set doubles from 6 to 12 company-weeks at 04, so points before and after 04 aren&apos;t directly comparable. Gaps
            smaller than the unchanged control&apos;s own swing between identical suites (≈3 recall cases, ≈4 trap hits on test) are noise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressChart points={its.map((i) => ({ id: i.id, recall: i.results.candidate.recall, precision: i.results.candidate.precision, judgePass: i.results.candidate.judgePass }))} gates={gates} />
        </CardContent>
      </Card>
      {its.map((it) => (
        <IterationCard key={it.id} it={it} gates={gates} />
      ))}
    </div>
  );
}
