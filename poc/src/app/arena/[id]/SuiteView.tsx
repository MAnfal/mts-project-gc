import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import RuleGrid from "@/components/RuleGrid";
import HowItWorks from "@/components/HowItWorks";
import SuiteDashboard from "@/components/SuiteDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cellByKey } from "@/lib/arena";
import { evalsets, experiment, getCompany, judges, loadKey, setups } from "@/lib/config";
import { listWindow } from "@/lib/fr";
import { modelLabel } from "@/lib/models";
import { suiteReport } from "@/lib/suite";
import type { LabelSet, RunRecord } from "@/lib/types";

/** Interviewer view: every setup × every eval set, aggregated into charts, with a per-company-week drill-down. */
export default async function SuiteView({ id, runs, set }: { id: string; runs: RunRecord[]; set?: string }) {
  const report = suiteReport(runs);
  const sets = evalsets().filter((e) => runs.some((r) => r.config.evalset === e.id));
  const pick = sets.find((e) => e.id === set) ?? sets[0];
  const running = report.totals.running;
  const repeat = Math.max(...runs.map((r) => (r.config.repeatIndex ?? 0) + 1));
  const panel = judges();

  const setRuns = runs.filter((r) => r.config.evalset === pick?.id && !r.error?.startsWith("Superseded"));
  const key: LabelSet | null = pick ? loadKey(pick.company, pick.windowStart, pick.windowEnd) : null;
  const keyed: LabelSet = key ?? { profileId: pick?.company ?? "", windowStart: "", windowEnd: "", relevant: [], reviewedAgencies: [], notes: {}, updatedAt: "" };
  const docs = pick ? new Map((await listWindow(pick.windowStart, pick.windowEnd)).map((d) => [d.document_number, d])) : new Map();
  const cellKeys = report.setups.map((s) => s.key);
  const gridRows = [...cellKeys]
    .sort((a, b) => report.setups.find((s) => s.key === a)!.colorIndex - report.setups.find((s) => s.key === b)!.colorIndex)
    .map((k) => ({ cell: cellByKey(k)!, runs: setRuns.filter((r) => r.config.cell === k) }))
    .filter((r) => r.cell);

  return (
    <div className="flex flex-col gap-6">
      <AutoRefresh active={running > 0} ms={5000} />
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-xl font-semibold">Eval suite · {sets.length} company-weeks × {report.setups.length} setups × {repeat} repeats</h1>
          <p className="text-sm text-muted-foreground">
            {report.totals.runs - running} of {report.totals.runs} runs finished{running ? " — refreshes on its own" : ""} · ${report.totals.costUsd.toFixed(2)} spent · companies:{" "}
            {[...new Set(sets.map((e) => getCompany(e.company).name))].join(", ")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Judge panel: {panel.judges.map((j) => modelLabel(j.model)).join(" · ")} — {panel.minAgree} of {panel.judges.length} must agree. Score weights from config/experiment.yaml.
          </p>
        </div>
        <Link href="/" className="ml-auto text-sm underline">New run</Link>
      </div>

      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="how">How it works</TabsTrigger>
        </TabsList>
        <TabsContent value="how" className="mt-4">
          <HowItWorks
            report={report}
            judgeModels={panel.judges.map((j) => modelLabel(j.model))}
            minAgree={panel.minAgree}
            setupConfig={setups().setups.map((x) => ({ ...x, jevThreshold: setups().methods.find((m) => m.id === x.method)?.jevThreshold }))}
          />
        </TabsContent>
        <TabsContent value="results" className="mt-4 flex flex-col gap-6">
      <SuiteDashboard report={report} gates={experiment().evals.gates} />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Drill down: one company-week</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {sets.map((e) => (
            <Link
              key={e.id}
              href={`/arena/${id}?set=${e.id}`}
              className={`rounded-md border px-3 py-1 ${e.id === pick?.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {getCompany(e.company).name} · {e.windowStart.slice(5)}–{e.windowEnd.slice(5)} {e.split === "test" ? "(test)" : "(dev)"}
            </Link>
          ))}
        </div>
        {pick && <RuleGrid rows={gridRows} keyed={keyed} hasKey={!!key} docs={docs} />}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
