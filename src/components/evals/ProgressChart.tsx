"use client";

import { useRouter } from "next/navigation";
import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { EvalTargets } from "@/lib/config/schemas";
import type { ChartPoint, ChartSeries } from "@/lib/evals/chartSeries";
import { formatShare } from "@/lib/evals/story";
import { OUTCOME_LABEL, iterationNumber } from "./EvalSidebar";
import { provenance, shortSuite } from "./Scoreboard";

const MEASURES = ["recall", "precision"] as const;
type Measure = (typeof MEASURES)[number];
const COLOR: Record<Measure, string> = { recall: "var(--series-recall)", precision: "var(--series-precision)" };
const NAME: Record<Measure, string> = { recall: "Recall", precision: "Precision" };
const config: ChartConfig = { recall: { label: "Recall", color: COLOR.recall }, precision: { label: "Precision", color: COLOR.precision } };

/**
 * Filled = kept, hollow = dropped, square = baseline; the live point is larger. Each marker is a real SVG link
 * to its iteration (keyboard-reachable, named for screen readers); a click navigates client-side.
 */
function Marker({ p, m, cx, cy, onOpen }: { p: ChartPoint; m: Measure; cx: number; cy: number; onOpen: (id: string) => void }) {
  const r = p.live ? 7 : 5.5;
  const paint = {
    stroke: p.marker === "filled" ? "var(--card)" : COLOR[m],
    strokeWidth: 2,
    fill: p.marker === "filled" ? COLOR[m] : "var(--card)",
  };
  const value = p[m].value === null ? "no value" : formatShare(p[m].value);
  return (
    <a
      href={`/evals/iterations/${p.id}`}
      aria-label={`${iterationNumber(p.id)} ${p.label}, ${OUTCOME_LABEL[p.outcome]}: ${NAME[m]} ${value} (${provenance(p[m])}). Open this iteration.`}
      style={{ cursor: "pointer" }}
      onClick={(e) => {
        e.preventDefault();
        onOpen(p.id);
      }}
    >
      {p.marker === "square" ? <rect x={cx - 6} y={cy - 6} width={12} height={12} rx={2} {...paint} /> : <circle cx={cx} cy={cy} r={r} {...paint} />}
    </a>
  );
}

function PointTooltip({ p }: { p: ChartPoint }) {
  return (
    <div className="flex max-w-[320px] flex-col gap-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      <span className="font-semibold">
        {iterationNumber(p.id)} {p.label} · {OUTCOME_LABEL[p.outcome]}
      </span>
      {MEASURES.map((m) => (
        <span key={m}>
          <span style={{ color: COLOR[m] }} className="font-semibold">
            {NAME[m]} {p[m].value === null ? "—" : formatShare(p[m].value)}
          </span>{" "}
          <span className="text-muted-foreground">{provenance(p[m])}</span>
        </span>
      ))}
      <span className="text-caption">Click the point to open this iteration.</span>
    </div>
  );
}

/**
 * "How it got here": recall and precision per iteration (design/HiEvalSummary.dc.html), with dashed targets,
 * a break where the eval set changed size, and the run-to-run noise band shaded at the live point. Ported in
 * spirit from the POC's ProgressChart (Recharts), with one line per segment so no line crosses a break.
 */
export function ProgressChart({ series, targets }: { series: ChartSeries; targets: EvalTargets }) {
  const router = useRouter();
  const open = (id: string) => router.push(`/evals/iterations/${id}`);
  const byId = new Map(series.points.map((p) => [p.id, p]));
  const values = series.points.flatMap((p) => [p.recall.value, p.precision.value]).filter((v): v is number => v !== null);
  const floor = Math.max(0, Math.floor(Math.min(...values, targets.precision, targets.recall) * 10) / 10);
  const ticks = Array.from({ length: Math.round((1 - floor) * 10) + 1 }, (_, i) => Number((floor + i / 10).toFixed(1)));
  const band = series.band;

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <ChartContainer config={config} className="aspect-auto h-[300px] w-full min-w-[620px]">
          <LineChart data={series.rows} margin={{ top: 24, right: 24, left: 4, bottom: 8 }} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="id"
              tickLine={false}
              interval={0}
              padding={{ left: 28, right: 28 }}
              tickFormatter={(id: string) => `${iterationNumber(id)} ${byId.get(id)?.label ?? ""}`}
              tick={{ fontSize: 11 }}
            />
            <YAxis domain={[floor, 1]} ticks={ticks} tickFormatter={(v: number) => formatShare(v)} width={48} tick={{ fontSize: 11 }} />
            {series.breaks.map((b) => {
              const i = series.points.findIndex((p) => p.id === b.before);
              return (
                <ReferenceArea
                  key={b.before}
                  x1={series.points[i - 1].id}
                  x2={b.before}
                  fill="var(--secondary)"
                  fillOpacity={0.45}
                  label={{ value: `eval set ${b.from} → ${b.to} company-weeks`, position: "insideBottom", fontSize: 11, fill: "var(--muted-foreground)" }}
                />
              );
            })}
            {band
              ? MEASURES.map((m) =>
                  band[m] ? (
                    <ReferenceArea
                      key={`band-${m}`}
                      x1={band.at}
                      x2={band.at}
                      y1={band[m][0]}
                      y2={band[m][1]}
                      shape={(props: { x: number; y: number; height: number }) => (
                        <rect x={props.x - 24} y={props.y} width={48} height={props.height} rx={4} fill={COLOR[m]} fillOpacity={0.1} />
                      )}
                    />
                  ) : null,
                )
              : null}
            <ReferenceLine y={targets.recall} stroke={COLOR.recall} strokeDasharray="4 4" strokeOpacity={0.55} />
            <ReferenceLine y={targets.precision} stroke={COLOR.precision} strokeDasharray="4 4" strokeOpacity={0.6} />
            <ChartTooltip
              cursor={false}
              content={({ active, label }) => {
                const p = active ? byId.get(String(label)) : undefined;
                return p ? <PointTooltip p={p} /> : null;
              }}
            />
            {series.segments.flatMap((seg) =>
              MEASURES.map((m) => (
                <Line
                  key={`${m}_${seg}`}
                  dataKey={`${m}_${seg}`}
                  name={NAME[m]}
                  stroke={COLOR[m]}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  connectNulls={false}
                  activeDot={false}
                  dot={(props: { cx?: number; cy?: number; index: number; payload: { id: string } }) => {
                    const p = byId.get(props.payload.id);
                    if (!p || props.cx == null || props.cy == null || p.segment !== seg)
                      return <g key={`${m}-${seg}-${props.index}`} />;
                    return <Marker key={`${m}-${seg}-${props.index}`} p={p} m={m} cx={props.cx} cy={props.cy} onOpen={open} />;
                  }}
                />
              )),
            )}
          </LineChart>
        </ChartContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-muted-foreground">
        {MEASURES.map((m) => (
          <span key={m} className="inline-flex items-center gap-2">
            <svg width="20" height="10" aria-hidden="true">
              <line x1="0" y1="5" x2="20" y2="5" stroke={COLOR[m]} strokeWidth="2.5" />
            </svg>
            {NAME[m]} · target {formatShare(targets[m])} (dashed)
          </span>
        ))}
        <span>Filled kept · hollow dropped · square baseline</span>
      </div>
      <p className="m-0 text-[13px] leading-relaxed text-caption">
        Each point is that iteration&apos;s setup over its own suite, all weeks. The lines break where the eval set changed size.
        {band
          ? ` The shaded band at the live point is the run-to-run noise: ${band.setup} re-run unchanged in ${band.suites.map(shortSuite).join(" and ")}; a gap inside it is within the swing between two identical runs.`
          : " No noise band is shown: the data has no unchanged control run in two suites."}{" "}
        Hover a point for exact numbers; click it to open that iteration.
      </p>
    </div>
  );
}
