import Link from "next/link";
import type { RunRecord } from "@/lib/types";

export default function RunsTable({ runs }: { runs: RunRecord[] }) {
  return (
    <table className="t">
      <thead>
        <tr><th>Run</th><th>Mode</th><th>Model</th><th>Filter</th><th>Group</th><th>Status</th><th>Items</th><th>Cost</th><th>Time</th></tr>
      </thead>
      <tbody>
        {runs.map((r) => (
          <tr key={r.id}>
            <td className="font-mono text-xs"><Link className="underline" href={`/runs/${r.id}`}>{r.id.slice(0, 19)}</Link></td>
            <td>{r.config.mode}</td>
            <td className="font-mono text-xs">{r.config.model.split("/")[1]}</td>
            <td>{r.config.mode === "pipeline" ? `${r.config.filter}${r.config.filter !== "llm" ? ` @${r.config.jevThreshold}` : ""}` : "—"}</td>
            <td className="font-mono text-xs">{r.config.group ?? ""}</td>
            <td>{r.status}{r.error ? ` — ${r.error.slice(0, 40)}` : ""}</td>
            <td>{r.items?.length ?? "—"}</td>
            <td className="font-mono text-xs">${r.totalCostUsd.toFixed(3)}</td>
            <td className="font-mono text-xs">{(r.totalMs / 1000).toFixed(0)}s</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
