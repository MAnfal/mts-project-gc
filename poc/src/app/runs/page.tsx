import { connection } from "next/server";
import RunForm from "@/components/RunForm";
import RunsTable from "@/components/RunsTable";
import { PROFILES } from "@/lib/profiles";
import { listRuns } from "@/lib/store";

export default async function RunsPage() {
  await connection();
  const runs = await listRuns();
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-lg font-semibold mb-1">Single run (debug)</h1>
        <p className="text-sm text-muted-foreground mb-3">Config → Scan (Federal Register API, optional Exa leads) → Filter (Jev / LLM) → Verify + Tier (code) → Output (LLM). Baseline = one prompt with the model&apos;s native web search.</p>
        <RunForm profiles={PROFILES.map((p) => ({ id: p.id, name: p.name }))} />
      </section>
      <section>
        <h2 className="font-semibold mb-2">Runs</h2>
        <div className="box overflow-x-auto"><RunsTable runs={runs} /></div>
      </section>
    </div>
  );
}
