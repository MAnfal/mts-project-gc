import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SuiteReport } from "@/lib/suite";

type Setup = SuiteReport["setups"][number];
type Funnel = Setup["funnel"];

const avg = (f: Funnel, name: string) => f.find((s) => s.name === name || s.name.startsWith(name));
const n = (x: number | null | undefined) => (x === null || x === undefined ? "–" : Math.round(x).toString());
const sec = (x: number | null | undefined) => (x === null || x === undefined ? "" : `${(x / 1000).toFixed(1)}s`);
const usd = (x: number | null | undefined) => (x === null || x === undefined ? "" : `$${x.toFixed(3)}`);

function Step({ title, who, what, stat }: { title: string; who: "code" | "cheap model" | "LLM" | "LLM + search" | "3 LLM judges"; what: string; stat?: string }) {
  const tone = who === "code" ? "bg-emerald-500/15" : who === "cheap model" ? "bg-sky-500/15" : "bg-violet-500/15";
  return (
    <div className="rounded-lg border p-3 flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{title}</span>
        <Badge variant="secondary" className={`${tone} ml-auto shrink-0`}>{who}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{what}</p>
      {stat && <p className="text-xs font-mono">{stat}</p>}
    </div>
  );
}

const Arrow = () => <div className="hidden lg:flex items-center justify-center text-muted-foreground">→</div>;

function Lane({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${steps.length * 2 - 1}, minmax(0, auto))` }}>
        {steps.flatMap((s, i) => (i ? [<Arrow key={`a${i}`} />, <div key={i}>{s}</div>] : [<div key={i}>{s}</div>]))}
      </div>
    </div>
  );
}

/** The workflow as a diagram, with this suite's real average counts per step, and every setup's config. */
export default function HowItWorks({ report, judgeModels, minAgree, setupConfig }: { report: SuiteReport; judgeModels: string[]; minAgree: number; setupConfig: { id: string; label: string; model: string; method: string; promptSet?: string; jevThreshold?: number }[] }) {
  const winner = report.setups[0];
  const pipe = report.setups.find((s) => s.config?.method === "jev+llm" && s.funnel.some((f) => f.name === "filter:jev")) ?? winner;
  const base = report.setups.find((s) => s.config?.method === "baseline");
  const f = pipe.funnel;
  const scan = avg(f, "scan:federal-register");
  const jev = avg(f, "filter:jev");
  const llm = avg(f, "filter:llm");
  const ver = avg(f, "verify+tier");
  const act = avg(f, "output:actions");
  const bs = base ? avg(base.funnel, "baseline:search") : undefined;
  const br = base ? avg(base.funnel, "baseline:resolve+verify") : undefined;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>The workflow</CardTitle>
          <CardDescription>
            Inputs are fixed and frozen: a <b>company profile</b> (config/companies) and a <b>week</b> of Federal Register documents (config/evalsets/weeks). A setup
            only chooses the model, the filter method and the prompt set. Numbers are this suite&apos;s averages per run for &ldquo;{pipe.label}&rdquo;
            {base ? <> and &ldquo;{base.label}&rdquo;</> : null}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 overflow-x-auto">
          <Lane
            title="Pipeline setups (Jev filter or read-everything)"
            steps={[
              <Step key="s" title="1 · Scan" who="code" what="Every document published that week (frozen copy of the FR API)." stat={`${n(scan?.outAvg)} documents`} />,
              <Step key="j" title="2 · Jev filter" who="cheap model" what="Probability each doc matters to the company; keep ≥ threshold. Skipped by “reads every document”." stat={`${n(jev?.inAvg)} → ${n(jev?.outAvg)} · ${sec(jev?.msAvg)} · ${usd(jev?.costAvg)}`} />,
              <Step key="l" title="3 · LLM filter" who="LLM" what="Batches of 20: relevant? why? which area? Prompt set: default or strict." stat={`${n(llm?.inAvg)} → ${n(llm?.outAvg)} · ${sec(llm?.msAvg)} · ${usd(llm?.costAvg)}`} />,
              <Step key="v" title="4 · Verify + tier" who="code" what="Re-fetch each doc; dates from official fields or a quote checked in govinfo text; tier by config rules; owner by area." stat={`${n(ver?.inAvg)} → ${n(ver?.outAvg)} · ${sec(ver?.msAvg)} · ${usd(ver?.costAvg)}`} />,
              <Step key="a" title="5 · Write actions" who="LLM" what="One plain-English action per item; any date in the text is stripped (dates come only from step 4)." stat={`${n(act?.outAvg)} items · ${usd(act?.costAvg)}`} />,
            ]}
          />
          {base && (
            <Lane
              title="Baseline (what we compare against)"
              steps={[
                <Step key="b1" title="1 · One prompt + web search" who="LLM + search" what="The model searches the web for the week's rules that affect the company." stat={`${sec(bs?.msAvg)} · ${usd(bs?.costAvg)}`} />,
                <Step key="b2" title="2 · Format" who="LLM" what="Turns its research into the same item list." />,
                <Step key="b3" title="3 · Resolve + check" who="code" what="Each claimed doc must exist in the Federal Register and in the week; dates checked like step 4. Made-up docs are dropped." stat={`${n(br?.inAvg)} claims → ${n(br?.outAvg)} kept`} />,
              ]}
            />
          )}
          <Lane
            title="Grading and aggregation (same for every setup)"
            steps={[
              <Step key="g1" title="A · Code vs answer key" who="code" what="Found / missed / fell for a trap / extra; date, tier and owner right." />,
              <Step key="g2" title="B · Trace checks" who="code" what="Reads the run's JSONL trace: every doc decided, every date verified, no dates in actions, costs add up…" />,
              <Step key="g3" title="C · Judge panel" who="3 LLM judges" what={`${judgeModels.join(" · ")} vote PASS/FAIL per action (clear, grounded, covers the point); ${minAgree} of ${judgeModels.length} must agree.`} />,
              <Step key="g4" title="D · Aggregate" who="code" what="Per setup over every company-week and repeat: rates and per-run averages, pass^k for consistency, weighted overall score (config/experiment.yaml)." />,
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>The setups compared</CardTitle>
          <CardDescription>From config/setups.yaml (+ config/prompt-sets/). Measured $ and time are this suite&apos;s averages per run.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="text-left font-normal py-2">Setup</th>
                <th className="text-left font-normal">id</th>
                <th className="text-left font-normal">Model</th>
                <th className="text-left font-normal">Method</th>
                <th className="text-left font-normal">Prompt set</th>
                <th className="text-right font-normal">Jev cut-off</th>
                <th className="text-right font-normal">$ / run</th>
                <th className="text-right font-normal">Time / run</th>
              </tr>
            </thead>
            <tbody>
              {setupConfig.map((c) => {
                const s = report.setups.find((x) => x.key === c.id);
                return (
                  <tr key={c.id} className="border-b">
                    <td className="py-2">
                      {c.label} {s && report.setups[0]?.key === c.id && <Badge className="ml-1">★ best</Badge>}
                    </td>
                    <td className="font-mono text-xs">{c.id}</td>
                    <td>{c.model}</td>
                    <td>{c.method === "jev+llm" ? "Jev filter → LLM" : c.method === "llm" ? "LLM reads every document" : "1 prompt + web search"}</td>
                    <td>{c.promptSet ?? "default"}</td>
                    <td className="text-right">{c.method === "jev+llm" ? c.jevThreshold : "—"}</td>
                    <td className="text-right font-mono text-xs">{s ? `$${s.costPerRun.toFixed(3)}` : "—"}</td>
                    <td className="text-right font-mono text-xs">{s?.msMean ? `${Math.round(s.msMean / 1000)}s` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
