import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Cell } from "@/lib/arena";
import type { LabelSet, RunRecord } from "@/lib/types";
import { cn } from "@/lib/utils";
import { trapsOf } from "@/lib/grade";


/** Rule-by-rule drill-down for one company-week: every key case (and every extra flag) × every setup. */
export default function RuleGrid({ rows, keyed, hasKey, docs }: { rows: { cell: Cell; runs: RunRecord[] }[]; keyed: LabelSet; hasKey: boolean; docs: Map<string, { title: string }> }) {
  const flagged = new Set(rows.flatMap((r) => r.runs.flatMap((x) => (x.items ?? []).map((i) => i.document_number))));
  const traps = trapsOf(keyed);
  const rank = (n: string) => (keyed.relevant.includes(n) ? 0 : traps[n] ? 1 : 2);
  const docNums = [...new Set([...keyed.relevant, ...Object.keys(traps), ...flagged])].sort((a, b) => rank(a) - rank(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rule by rule</CardTitle>
        <CardDescription>
          Rows: rules that matter, then traps (should NOT be flagged), then other extras. ✓ found · ✗ missed · ⚑ fell for a trap · + extra · ⚠ date differs from the key. With
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
                  {r.cell.label}
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
                    {d && <div className="text-muted-foreground">{d.reason}</div>}{!d && traps[n] && <div className="text-muted-foreground">Trap: {traps[n].reason}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {inKey ? (
                      <>
                        <Badge variant="outline">matters{d && d.confidence !== "high" ? ` · ${d.confidence}` : ""}</Badge>
                        {d?.deadline && <div className="text-muted-foreground mt-1">{d.deadline.kind} {d.deadline.date}</div>}
                      </>
                    ) : (
                      traps[n] ? (
                        <Badge variant="outline" className="border-dashed">trap · {traps[n].trapType}</Badge>
                      ) : (
                        <span className="text-muted-foreground">{hasKey ? "not in key" : "—"}</span>
                      )
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
                        className={cn("text-center", !hasKey ? "" : inKey ? "bg-green-500/10 text-green-800 dark:text-green-300" : traps[n] ? "bg-red-500/10 text-red-800 dark:text-red-300" : "bg-amber-500/10 text-amber-800 dark:text-amber-300")}
                        title={hits.map((i) => `${i.tier}${i.deadline ? ` · ${i.deadline.kind} ${i.deadline.date}${i.deadline.verified ? "" : " (unverified)"}` : ""}`).join("\n")}
                      >
                        {hasKey ? (inKey ? "✓" : traps[n] ? "⚑" : "+") : "●"}
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
