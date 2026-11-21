import Link from "next/link";
import { connection } from "next/server";
import AutoRefresh from "@/components/AutoRefresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALL_CELLS, METHODS, arenaRuns, type Cell } from "@/lib/arena";
import { listWindow } from "@/lib/fr";
import { JUDGE_MODEL } from "@/lib/judge";
import { modelLabel, searchKind } from "@/lib/models";
import { getProfile } from "@/lib/profiles";
import { arenaTotals, summarizeCell, type CellSummary } from "@/lib/score";
import { loadLabels } from "@/lib/store";
import type { LabelSet, RunRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const num = (x: number | null) => (x === null ? "—" : Number.isInteger(x) ? String(x) : x.toFixed(1));
const methodShort: Record<Cell["method"], string> = { "jev+llm": "Jev→LLM", llm: "LLM only", baseline: "Baseline" };

/** Index of the best value in a column (ties: all), ignoring nulls. */
function best(vals: (number | null)[], dir: "max" | "min") {
  const v = vals.filter((x): x is number => x !== null);
  if (!v.length) return new Set<number>();
  const b = dir === "max" ? Math.max(...v) : Math.min(...v);
  return new Set(vals.flatMap((x, i) => (x === b ? [i] : [])));
}

export default async function ArenaPage({ params }: PageProps<"/arena/[id]">) {
  await connection();
  const { id } = await params;
  const runs = await arenaRuns(id);
  if (!runs.length) return <p>Arena not found.</p>;
  const cfg = runs[0].config;
  const profile = getProfile(cfg.profileId);
  const key = await loadLabels(cfg.profileId, cfg.windowStart, cfg.windowEnd);
  const keyed: LabelSet = key ?? { profileId: cfg.profileId, windowStart: cfg.windowStart, windowEnd: cfg.windowEnd, relevant: [], reviewedAgencies: [], notes: {}, updatedAt: "" };
  const docs = new Map((await listWindow(cfg.windowStart, cfg.windowEnd)).map((d) => [d.document_number, d]));

  const cells = ALL_CELLS.filter((c) => runs.some((r) => r.config.cell === c.key));
  const runsOf = (c: Cell) => runs.filter((r) => r.config.cell === c.key);
  const rows = cells.map((c) => ({ cell: c, runs: runsOf(c), s: summarizeCell(runsOf(c), keyed) }));
  const totals = arenaTotals(rows.map((r) => r.s));
  const running = runs.filter((r) => r.status === "running").length;
  // Superseded runs (re-run after a bug) still count toward cost, but not toward "how many times each setup ran".
  const live = (rs: RunRecord[]) => rs.filter((r) => !r.error?.startsWith("Superseded"));
  const repeat = Math.max(...rows.map((r) => live(r.runs).length));
  const N = keyed.relevant.length;

  const col = (f: (s: CellSummary) => number | null, dir: "max" | "min") => best(rows.map((r) => f(r.s)), dir);
  const bestRecall = col((s) => s.recall, "max");
  const bestPrec = col((s) => s.precision, "max");
  const bestDates = col((s) => (s.datesChecked ? s.datesCorrect / s.datesChecked : null), "max");
  const bestClarity = col((s) => s.clarity, "max");
  const bestCost = col((s) => (s.finished ? s.costUsd / s.runs : null), "min");
  const bestTime = col((s) => s.msMean, "min");
  const B = (set: Set<number>, i: number) => (set.has(i) ? "font-semibold" : "");

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={running > 0} ms={4000} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">{profile.name} · week of {cfg.windowStart}</h1>
          <p className="text-sm text-muted-foreground">
            {runs.length - running} of {runs.length} runs finished{running ? " — page refreshes on its own" : ""} · each setup ran {repeat}×
          </p>
        </div>
        <Link href="/" className="ml-auto text-sm underline">New arena</Link>
      </div>

      {!key && (
        <Card className="border-amber-500/50">
          <CardContent className="text-sm">No answer key for this company and week yet, so found / missed / dates can&apos;t be graded. Cost, time and clarity still show.</CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Scoreboard</CardTitle>
          <CardDescription>
            Graded against the answer key ({N} rules that matter{key?.provenance ? ` · ${key.provenance}` : ""}). Bold = best in column. Everything except
            &ldquo;Clarity&rdquo; is checked by code; clarity is scored by {modelLabel(JUDGE_MODEL)} ({JUDGE_MODEL}).
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Setup</TableHead>
                <TableHead className="text-right" title="Rules from the key it found (avg per run)">Found</TableHead>
                <TableHead className="text-right" title="Rules from the key it missed">Missed</TableHead>
                <TableHead className="text-right" title="Rules it flagged that aren't in the key">Extra</TableHead>
                <TableHead className="text-right" title="Share of found rules whose deadline matches the key exactly">Dates right</TableHead>
                {repeat > 1 && <TableHead className="text-right" title="Share of flagged rules that every repeat agreed on">Same every run</TableHead>}
                <TableHead className="text-right" title="LLM judge, 0–100: plain English, concrete next step, right owner">Clarity</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">$ / run</TableHead>
                <TableHead className="text-right">$ total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {METHODS.map((m) => {
                const group = rows.map((r, i) => ({ ...r, i })).filter((r) => r.cell.method === m.id);
                if (!group.length) return null;
                return [
                  <TableRow key={m.id} className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={repeat > 1 ? 10 : 9} className="text-xs uppercase tracking-wide text-muted-foreground">{m.label}</TableCell>
                  </TableRow>,
                  ...group.map(({ cell, runs: rs, s, i }) => (
                    <TableRow key={cell.key}>
                      <TableCell>
                        <div className="font-medium">{modelLabel(cell.model)}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-1 items-center">
                          {cell.method === "baseline" && <span>{searchKind(cell.model)} ·</span>}
                          {live(rs).map((r, k) => (
                            <Link key={r.id} href={`/runs/${r.id}`} className="underline">run {k + 1}</Link>
                          ))}
                          {s.running > 0 && <Badge variant="secondary">running</Badge>}
                          {live(rs).some((r) => r.status === "error") && (
                            <Badge variant="destructive" title={live(rs).map((r) => r.error).filter(Boolean).join("\n")}>{live(rs).filter((r) => r.status === "error").length} failed</Badge>
                          )}
                          {rs.length > live(rs).length && (
                            <Badge variant="outline" title={rs.filter((r) => !live(rs).includes(r)).map((r) => r.error).join("\n")}>{rs.length - live(rs).length} superseded</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={cn("text-right", B(bestRecall, i))}>{key && s.found !== null ? `${num(s.found)}/${N}` : "—"}</TableCell>
                      <TableCell className="text-right">{key ? num(s.missed) : "—"}</TableCell>
                      <TableCell className={cn("text-right", B(bestPrec, i))}>{key ? num(s.extra) : num(s.finished ? rs.reduce((a, r) => a + (r.items?.length ?? 0), 0) / s.finished : null)}</TableCell>
                      <TableCell className={cn("text-right", B(bestDates, i))}>{s.datesChecked ? `${s.datesCorrect}/${s.datesChecked}` : "—"}</TableCell>
                      {repeat > 1 && <TableCell className="text-right">{s.consistency ? pct(s.consistency.relevanceAgreement) : "—"}</TableCell>}
                      <TableCell className={cn("text-right", B(bestClarity, i))}>{s.clarity === null ? "—" : Math.round(s.clarity * 100)}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", B(bestTime, i))}>{s.msMean === null ? "—" : `${Math.round(s.msMean / 1000)}s`}</TableCell>
                      <TableCell className={cn("text-right font-mono text-xs", B(bestCost, i))}>{s.runs ? `$${(s.costUsd / s.runs).toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right font-mono text-xs">${s.costUsd.toFixed(2)}</TableCell>
                    </TableRow>
                  )),
                ];
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={repeat > 1 ? 8 : 7}>Total · {totals.runs} runs</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono text-xs font-semibold">${totals.costUsd.toFixed(2)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          <p className="mt-3 text-xs text-muted-foreground">
            Goal from the RFC: find ≥ 90% of the key, ≤ 20% extra, every date right, same answer every run. &ldquo;$ total&rdquo; includes the clarity judge.
          </p>
        </CardContent>
      </Card>

      <RuleGrid rows={rows} keyed={keyed} hasKey={!!key} docs={docs} />
    </div>
  );
}

function RuleGrid({ rows, keyed, hasKey, docs }: { rows: { cell: Cell; runs: RunRecord[] }[]; keyed: LabelSet; hasKey: boolean; docs: Map<string, { title: string }> }) {
  const flagged = new Set(rows.flatMap((r) => r.runs.flatMap((x) => (x.items ?? []).map((i) => i.document_number))));
  const docNums = [...new Set([...keyed.relevant, ...flagged])].sort((a, b) => Number(keyed.relevant.includes(b)) - Number(keyed.relevant.includes(a)));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule by rule</CardTitle>
        <CardDescription>
          Rows: every rule in the key, then anything a setup flagged that isn&apos;t. ✓ found · ✗ missed · + extra (not in key) · ⚠ date differs from the key. With
          repeats, the number shows how many runs flagged it.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Rule</TableHead>
              <TableHead>Key</TableHead>
              {rows.map((r) => (
                <TableHead key={r.cell.key} className="text-center whitespace-normal min-w-16">
                  {modelLabel(r.cell.model)}
                  <div className="font-normal text-muted-foreground">{methodShort[r.cell.method]}</div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {docNums.map((n) => {
              const inKey = keyed.relevant.includes(n);
              const d = keyed.details?.[n];
              const title = docs.get(n)?.title ?? rows.flatMap((r) => r.runs.flatMap((x) => x.items ?? [])).find((i) => i.document_number === n)?.title ?? n;
              return (
                <TableRow key={n}>
                  <TableCell className="whitespace-normal">
                    <a className="hover:underline" href={`https://www.federalregister.gov/d/${n}`} target="_blank" rel="noreferrer">{title}</a>
                    {d && <div className="text-muted-foreground">{d.reason}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {inKey ? (
                      <>
                        <Badge variant="outline">matters{d && d.confidence !== "high" ? ` · ${d.confidence}` : ""}</Badge>
                        {d?.deadline && <div className="text-muted-foreground mt-1">{d.deadline.kind} {d.deadline.date}</div>}
                      </>
                    ) : (
                      <span className="text-muted-foreground">{hasKey ? "not in key" : "—"}</span>
                    )}
                  </TableCell>
                  {rows.map((r) => {
                    const done = r.runs.filter((x) => x.status === "done");
                    const hits = done.map((x) => x.items?.find((i) => i.document_number === n)).filter((i) => !!i);
                    if (!done.length) return <TableCell key={r.cell.key} className="text-center text-muted-foreground">·</TableCell>;
                    const dateOff = d?.deadline && hits.some((i) => i.deadline?.date !== d.deadline!.date);
                    const tiers = [...new Set(hits.map((i) => i.tier))].join("/");
                    const count = done.length > 1 ? ` ${hits.length}/${done.length}` : "";
                    if (!hits.length)
                      return (
                        <TableCell key={r.cell.key} className={cn("text-center", inKey && "bg-red-500/10 text-red-700 dark:text-red-400")}>
                          {inKey ? "✗" : ""}
                        </TableCell>
                      );
                    return (
                      <TableCell
                        key={r.cell.key}
                        className={cn("text-center", !hasKey ? "" : inKey ? "bg-green-500/10 text-green-800 dark:text-green-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}
                        title={hits.map((i) => `${i.tier}${i.deadline ? ` · ${i.deadline.kind} ${i.deadline.date}${i.deadline.verified ? "" : " (unverified)"}` : ""}`).join("\n")}
                      >
                        {hasKey ? (inKey ? "✓" : "+") : "●"}
                        {count}
                        {dateOff ? " ⚠" : ""}
                        <div className="text-muted-foreground">{tiers}</div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
