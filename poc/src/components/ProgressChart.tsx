"use client";
import { CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const cfg: ChartConfig = {
  recall: { label: "Recall (found what matters)", color: "var(--series-1)" },
  precision: { label: "Precision (flags that were right)", color: "var(--series-2)" },
  judgePass: { label: "Judges: action OK", color: "var(--series-3)" },
};

/** Precision and recall per iteration against the RFC targets (one axis, percent). */
export default function ProgressChart({ points, gates }: { points: { id: string; recall: number | null; precision: number | null; judgePass: number | null }[]; gates: { recall: number; precision: number } }) {
  const data = points.map((p) => ({
    id: p.id,
    recall: p.recall === null ? null : Math.round(p.recall * 1000) / 10,
    precision: p.precision === null ? null : Math.round(p.precision * 1000) / 10,
    judgePass: p.judgePass === null ? null : Math.round(p.judgePass * 1000) / 10,
  }));
  return (
    <ChartContainer config={cfg} className="h-80 w-full">
      <LineChart data={data} margin={{ top: 20, right: 40, left: 0, bottom: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="id" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} unit="%" width={44} />
        <ReferenceLine y={gates.recall * 100} stroke="var(--series-1)" strokeDasharray="4 4" label={{ value: `recall target ${gates.recall * 100}%`, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" }} />
        <ReferenceLine y={gates.precision * 100} stroke="var(--series-2)" strokeDasharray="4 4" label={{ value: `precision target ${gates.precision * 100}%`, position: "insideBottomRight", fontSize: 11, fill: "var(--muted-foreground)" }} />
        <ChartTooltip content={<ChartTooltipContent formatter={(v, name) => <span>{cfg[name as keyof typeof cfg]?.label}: <b>{v}%</b></span>} />} />
        <ChartLegend content={<ChartLegendContent />} />
        {(["recall", "precision", "judgePass"] as const).map((k) => (
          <Line key={k} dataKey={k} stroke={`var(--color-${k})`} strokeWidth={2} dot={{ r: 5 }} isAnimationActive={false} connectNulls>
            <LabelList dataKey={k} position="top" fontSize={11} className="fill-foreground" formatter={(v) => (v === null || v === undefined ? "" : `${v}%`)} />
          </Line>
        ))}
      </LineChart>
    </ChartContainer>
  );
}
