import { loadRun } from "@/lib/store";

/** report.json (the RFC's deliverable: one action item per relevant rule) or report.md for a finished run. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const run = await loadRun((await params).id);
  if (!run || run.status !== "done") return Response.json({ error: "not found or not finished" }, { status: 404 });
  const md = new URL(req.url).searchParams.get("format") === "md";
  if (md) return new Response(run.markdown ?? "", { headers: { "content-type": "text/markdown", "content-disposition": `attachment; filename="report.md"` } });
  const report = {
    company: run.config.customProfile?.name ?? run.config.profileId,
    window: { start: run.config.windowStart, end: run.config.windowEnd, asOf: run.config.asOf },
    items: (run.items ?? []).map((i) => ({
      document_number: i.document_number,
      title: i.title,
      tier: i.tier,
      tierReason: i.tierReason,
      deadline: i.deadline ? { date: i.deadline.date, kind: i.deadline.kind, verified: i.deadline.verified } : null,
      owner: i.owner,
      areas: i.areas,
      action: i.action,
      reason: i.reason,
      citation: i.citation,
      citationVerified: i.citationVerified,
      source: i.url,
      sourceTag: i.sourceTag,
    })),
  };
  return new Response(JSON.stringify(report, null, 2), { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="report.json"` } });
}
