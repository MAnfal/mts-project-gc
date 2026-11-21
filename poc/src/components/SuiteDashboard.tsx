"use client";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SuiteReport } from "@/lib/suite";

// 5 validated series colors (dataviz palette slots 1–5, light + dark); setups beyond 5 would need small multiples.
const color = (i: number) => `var(--series-${(i % 5) + 1})`;
const pct = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? "—" : `${Math.round(x * 100)}%`);
// The table shows one decimal so a value just under a gate (79.6% vs 80%) never displays as if it met it.
const pct1 = (x: number | null | undefined) => (x === null || x === undefined || Number.isNaN(x) ? "—" : `${(x * 100).toFixed(1)}%`);
const METRICS = [
  ["recall", "Found what matters"],
  ["precision", "Flags that were right"],
  ["trapAvoidance", "Traps avoided"],
  ["datesRight", "Dates right"],
  ["tierRight", "Tier right (given its dates)"],
  ["ownerRight", "Owner right"],
  ["judgePass", "Judges: action OK"],
  ["consistency", "Same every run"],
  ["traceChecks", "Trace checks"],
] as const;

type Setup = SuiteReport["setups"][number];

export default function SuiteDashboard({ report, gates }: { report: SuiteReport; gates: { recall: number; precision: number } }) {
  const S = report.setups;
  const cfg: ChartConfig = Object.fromEntries(S.map((s) => [s.key, { label: s.label, color: color(s.colorIndex) }]));
  const byColor = [...S].sort((a, b) => a.colorIndex - b.colorIndex);

  return (
    <div className="flex flex-col gap-6">
      <Scorecards setups={S} />
      <div className="grid gap-6 lg:grid-cols-2">
        <TradeOff setups={S} />
        <Outcomes setups={byColor} />
      </div>
      <MetricBars setups={byColor} cfg={cfg} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Consistency setups={byColor} cfg={cfg} />
        <Heatmap setups={byColor} />
      </div>
      <ScoreTable setups={S} gates={gates} totals={report.totals} />
    </div>
  );
}

function Dot({ i }: { i: number }) {
  return <span className="inline-block size-2.5 rounded-full shrink-0" style={{ background: color(i) }} aria-hidden />;
}

function Scorecards({ setups }: { setups: Setup[] }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {setups.map((s, rank) => (
        <Card key={s.key} className="gap-2 py-4" style={{ borderTop: `3px solid ${color(s.colorIndex)}` }}>
          <CardHeader className="px-4">
            <CardDescription className="flex items-center gap-2">
              <span className="font-mono">#{rank + 1}</span> <Dot i={s.colorIndex} /> {s.modelLabel}
              {rank === 0 && <Badge className="ml-auto">★ best overall</Badge>}
            </CardDescription>
            <CardTitle className="text-base">{s.label}</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="text-4xl font-semibold tabular-nums">{pct(s.score)}</div>
            <div className="text-xs text-muted-foreground">overall score</div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm tabular-nums">
              <div>
                <div className="font-medium">{pct(s.metrics.recall)}</div>
                <div className="text-xs text-muted-foreground">found</div>
              </div>
              <div>
                <div className="font-medium">${s.costPerRun.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">per run</div>
              </div>
              <div>
                <div className="font-medium">{s.msMean === null ? "—" : `${Math.round(s.msMean / 1000)}s`}</div>
                <div className="text-xs text-muted-foreground">per run</div>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.running > 0 && <Badge variant="secondary">{s.running} running</Badge>}
              {s.failed > 0 && <Badge variant="destructive" title={s.errors.join("\n")}>{s.failed} failed</Badge>}
              {s.madeUp > 0 && <Badge variant="outline">{(s.madeUp / Math.max(1, s.finished)).toFixed(1)} made-up doc numbers / run</Badge>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Pareto frontier: points no other point beats on both axes (lower x, higher y). */
function frontier(pts: { x: number; y: number }[]) {
  const sorted = [...pts].sort((a, b) => a.x - b.x || b.y - a.y);
  const out: typeof pts = [];
  for (const p of sorted) if (!out.length || p.y > out[out.length - 1].y) out.push(p);
  return out;
}

function TradeOff({ setups }: { setups: Setup[] }) {
  const view = (axis: "cost" | "time") => {
    const pts = setups
      .filter((s) => s.score !== null)
      .map((s, rank) => ({ key: s.key, name: s.label, rank: `#${rank + 1}`, x: axis === "cost" ? s.costPerRun : (s.msMean ?? 0) / 1000, y: Math.round((s.score ?? 0) * 100), i: s.colorIndex }));
    const front = frontier(pts);
    // Zoom the score axis to the data (scores cluster), keeping a little headroom; never pretend the axis starts at 0.
    const lo = Math.max(0, Math.floor((Math.min(...pts.map((p) => p.y)) - 5) / 5) * 5);
    return (
      <ChartContainer config={{}} className="h-72 w-full">
        <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" dataKey="x" name={axis === "cost" ? "$ per run" : "seconds per run"} tickFormatter={(v) => (axis === "cost" ? `$${v.toFixed(2)}` : `${v}s`)} label={{ value: axis === "cost" ? "$ per run →" : "seconds per run →", position: "insideBottom", offset: -12, fontSize: 12 }} />
          <YAxis type="number" dataKey="y" domain={[lo, 100]} unit="%" width={44} allowDataOverflow />
          <ZAxis range={[140, 140]} />
          <ChartTooltip content={<ChartTooltipContent hideIndicator labelKey="name" formatter={(_, __, item) => <span>{item.payload.name}: {item.payload.y}% · {axis === "cost" ? `$${item.payload.x.toFixed(2)}` : `${Math.round(item.payload.x)}s`}</span>} />} />
          <Line data={front} dataKey="y" type="linear" stroke="var(--muted-foreground)" strokeDasharray="4 4" dot={false} isAnimationActive={false} />
          {pts.map((p) => (
            <Scatter key={p.key} data={[p]} fill={color(p.i)} stroke="var(--background)" strokeWidth={2}>
              <LabelList dataKey="rank" position="right" offset={8} className="fill-foreground" fontSize={12} fontWeight={600} />
            </Scatter>
          ))}
        </ScatterChart>
      </ChartContainer>
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Is it worth the money?</CardTitle>
        <CardDescription>Overall score against cost and speed. Top-left is best; the dashed line joins the setups nothing else beats on both. Note the score axis is zoomed in.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="cost">
          <TabsList>
            <TabsTrigger value="cost">vs cost</TabsTrigger>
            <TabsTrigger value="time">vs time</TabsTrigger>
          </TabsList>
          <TabsContent value="cost">{view("cost")}</TabsContent>
          <TabsContent value="time">{view("time")}</TabsContent>
        </Tabs>
        <ul className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          {setups.map((s, rank) => (
            <li key={s.key} className="flex items-center gap-2">
              <Dot i={s.colorIndex} />
              <span className="font-semibold">#{rank + 1}</span> {s.label}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

const OUTCOMES = [
  { key: "tp", label: "Found (should flag)", color: "var(--status-good)" },
  { key: "fn", label: "Missed", color: "var(--status-critical)" },
  { key: "trapHit", label: "Fell for a trap", color: "var(--status-serious)" },
  { key: "unlabeled", label: "Other extra flags", color: "var(--status-warning)" },
] as const;

// Segments narrower than ~0.3 per run can't fit a label; their value is in the tooltip.
const one = (v: number) => (v >= 0.3 ? v.toFixed(1) : "");

function Outcomes({ setups }: { setups: Setup[] }) {
  // Average per run: totals ÷ graded runs, so a setup isn't penalised for running more often.
  const data = setups.map((s) => ({ name: s.label, runs: s.graded, totals: s.counts, ...s.countsPerRun }));
  const cfg: ChartConfig = Object.fromEntries(OUTCOMES.map((o) => [o.key, { label: o.label, color: o.color }]));
  return (
    <Card>
      <CardHeader>
        <CardTitle>What kind of mistakes? (average per run)</CardTitle>
        <CardDescription>On a typical run, how many rules it found, missed, wrongly flagged as traps, or flagged extra. Green is good; everything else is an error. Hover for totals across all runs.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={cfg} className="h-72 w-full">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} barCategoryGap={10}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(v, name, item) => (
                    <span>
                      {OUTCOMES.find((o) => o.key === name)?.label}: <b>{Number(v).toFixed(2)}</b> per run · {item.payload.totals[name as keyof Setup["counts"]]} total over {item.payload.runs} runs
                    </span>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {OUTCOMES.map((o, i) => (
              <Bar key={o.key} dataKey={o.key} stackId="a" fill={o.color} stroke="var(--background)" strokeWidth={2} radius={i === OUTCOMES.length - 1 ? [0, 4, 4, 0] : 0}>
                <LabelList dataKey={o.key} position="center" fontSize={10} className="fill-white" formatter={(v) => one(Number(v))} />
              </Bar>
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function MetricBars({ setups, cfg }: { setups: Setup[]; cfg: ChartConfig }) {
  const data = METRICS.map(([k, label]) => ({ metric: label, ...Object.fromEntries(setups.map((s) => [s.key, s.metrics[k] === null ? null : Math.round((s.metrics[k] as number) * 100)])) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Every metric, side by side</CardTitle>
        <CardDescription>Code-graded against the answer key, except &ldquo;Judges: action OK&rdquo; (3-judge panel, 2 of 3 must agree). Hover a bar for exact values.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={cfg} className="h-80 w-full">
          <BarChart data={data} barGap={2} barCategoryGap="18%">
            <CartesianGrid vertical={false} />
            <XAxis dataKey="metric" tick={{ fontSize: 11 }} interval={0} />
            <YAxis domain={[0, 100]} unit="%" width={44} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {setups.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={color(s.colorIndex)} radius={[4, 4, 0, 0]} stroke="var(--background)" strokeWidth={2} />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function Consistency({ setups, cfg }: { setups: Setup[]; cfg: ChartConfig }) {
  const K = Math.max(0, ...setups.map((s) => s.pass.length));
  const data = Array.from({ length: K }, (_, i) => ({ k: `pass^${i + 1}`, ...Object.fromEntries(setups.map((s) => [s.key, s.pass[i]?.value === null || s.pass[i] === undefined ? null : Math.round(s.pass[i].value! * 100)])) }));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Does it give the same answer every time?</CardTitle>
        <CardDescription>pass^k (as in τ²-bench): share of cases a setup gets right in all k repeats. A flat line means it&apos;s consistent; a drop means it&apos;s guessing.</CardDescription>
      </CardHeader>
      <CardContent>
        {K < 2 ? (
          <p className="text-sm text-muted-foreground">Needs at least 2 repeats per setup.</p>
        ) : (
          <ChartContainer config={cfg} className="h-64 w-full">
            <LineChart data={data} margin={{ left: 0, right: 24, top: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="k" />
              <YAxis domain={[0, 100]} unit="%" width={44} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {setups.map((s) => (
                <Line key={s.key} dataKey={s.key} stroke={color(s.colorIndex)} strokeWidth={2} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

const SLICE_LABEL: Record<string, string> = {
  "kind:direct": "Directly affects us",
  "kind:indirect": "Affects suppliers / customers",
  "trap:other-industry": "Trap: other industry",
  "trap:other-product": "Trap: other product / model",
  "trap:closed-or-expired": "Trap: already closed",
  "trap:withdrawn": "Trap: withdrawn",
  "trap:no-obligation": "Trap: mentions us, requires nothing",
  "trap:minor-correction": "Trap: minor correction",
  "trap:meeting-or-admin": "Trap: meeting / admin",
  "trap:other": "Trap: other",
  "split:dev": "Dev week (tuned on)",
  "split:test": "Test week (held out)",
};

function Heatmap({ setups }: { setups: Setup[] }) {
  const keys = [...new Set(setups.flatMap((s) => Object.keys(s.slices)))]
    .filter((k) => !k.startsWith("docType:"))
    .sort((a, b) => a.localeCompare(b));
  const heat = (v: number | null) => (v === null ? "var(--heat-0)" : `var(--heat-${Math.min(6, Math.max(1, Math.ceil(v * 6)))})`);
  const label = (k: string) => SLICE_LABEL[k] ?? k.replace("company:", "Company: ");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where does each setup break?</CardTitle>
        <CardDescription>Share of cases handled right, by case type. Darker is better; blank = no cases of that type.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th />
              {setups.map((s) => (
                <th key={s.key} className="font-normal text-muted-foreground px-1 pb-1 align-bottom">
                  <div className="flex items-center gap-1 justify-center">
                    <Dot i={s.colorIndex} />
                    <span className="line-clamp-2">{s.label}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <td className="pr-2 whitespace-nowrap text-muted-foreground">{label(k)}</td>
                {setups.map((s) => {
                  const r = s.slices[k];
                  const v = r && r.total ? r.correct / r.total : null;
                  return (
                    <td key={s.key} className="text-center rounded-sm h-7 min-w-16 tabular-nums" style={{ background: heat(v), color: v !== null && v > 0.6 ? "white" : undefined }} title={r ? `${r.correct}/${r.total}` : "no cases"}>
                      {v === null ? "" : `${Math.round(v * 100)}%`}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function ScoreTable({ setups, gates, totals }: { setups: Setup[]; gates: { recall: number; precision: number }; totals: SuiteReport["totals"] }) {
  const ok = (v: number | null, g?: number) => (g === undefined || v === null ? "" : v >= g ? " ✓" : " ✗");
  return (
    <Card>
      <CardHeader>
        <CardTitle>All numbers</CardTitle>
        <CardDescription>
          The table behind the charts. ✓/✗ against the RFC goals (found ≥ {Math.round(gates.recall * 100)}%, flags right ≥ {Math.round(gates.precision * 100)}%). &ldquo;Tier right&rdquo; is near-automatic
          for pipeline setups (tiers are computed by the same code from the dates they found), so it mostly measures the baseline. Recall rests on 14 distinct
          rules (42 checks with repeats).
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-b">
              <th className="text-left py-2 font-normal">Setup</th>
              <th className="text-right font-normal">Score</th>
              {METRICS.map(([k, l]) => (
                <th key={k} className="text-right font-normal px-1">{l}</th>
              ))}
              <th className="text-right font-normal">Runs</th>
              <th className="text-right font-normal">$ / run</th>
              <th className="text-right font-normal">Time / run</th>
            </tr>
          </thead>
          <tbody>
            {setups.map((s) => (
              <tr key={s.key} className="border-b">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <Dot i={s.colorIndex} />
                    {s.label}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-1 mt-0.5">
                    {s.runIds.slice(0, 6).map((id, n) => (
                      <Link key={id} href={`/runs/${id}/trace`} className="underline">trace {n + 1}</Link>
                    ))}
                    {s.runIds.length > 6 && <span>+{s.runIds.length - 6}</span>}
                  </div>
                </td>
                <td className="text-right font-semibold tabular-nums">{pct(s.score)}</td>
                {METRICS.map(([k]) => (
                  <td key={k} className="text-right tabular-nums px-1">
                    {pct1(s.metrics[k])}
                    {ok(s.metrics[k], k === "recall" ? gates.recall : k === "precision" ? gates.precision : undefined)}
                  </td>
                ))}
                <td className="text-right tabular-nums">{s.runs}</td>
                <td className="text-right font-mono text-xs" title={`$${s.costUsd.toFixed(2)} over ${s.runs} runs`}>${s.costPerRun.toFixed(3)}</td>
                <td className="text-right font-mono text-xs">{s.msMean === null ? "—" : `${Math.round(s.msMean / 1000)}s`}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-medium">
              <td className="py-2">Total spent on this suite</td>
              <td colSpan={METRICS.length + 1} />
              <td className="text-right tabular-nums">{totals.runs}</td>
              <td className="text-right font-mono text-xs" colSpan={2}>${totals.costUsd.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </CardContent>
    </Card>
  );
}
