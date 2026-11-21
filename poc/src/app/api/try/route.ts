import { differenceInCalendarDays, parseISO } from "date-fns";
import { after } from "next/server";
import { cellByKey, cellConfig } from "@/lib/arena";
import { CompanySchema, experiment, getCompany } from "@/lib/config";
import { execute, newRun } from "@/lib/pipeline/run";
import { budgetUsd, saveRun, spentUsd } from "@/lib/store";

export const maxDuration = 300;

/** User view: one run of the winning setup (config/experiment.yaml → userView.setup) on a demo or custom company. */
export async function POST(req: Request) {
  const body = (await req.json()) as { profileId?: string; custom?: { name: string; summary: string; applies: string[]; doesNotApply: string[] }; windowStart: string; windowEnd: string };
  const uv = experiment().userView;
  const days = differenceInCalendarDays(parseISO(body.windowEnd), parseISO(body.windowStart)) + 1;
  if (!(days >= 1 && days <= uv.maxWindowDays)) return Response.json({ error: `Pick 1–${uv.maxWindowDays} days` }, { status: 400 });
  if ((await spentUsd()) >= budgetUsd()) return Response.json({ error: "Budget exhausted" }, { status: 402 });

  let customProfile;
  if (body.custom) {
    const c = body.custom;
    const parsed = CompanySchema.safeParse({
      id: "custom",
      use: "demo",
      name: c.name || "My company",
      summary: c.summary,
      businessLines: [],
      applies: c.applies.filter(Boolean),
      doesNotApply: c.doesNotApply.filter(Boolean),
      areas: { general: { description: "Everything", owner: { name: "You (General Counsel)", email: "gc@example.com" } } },
      generalCounsel: { name: "You (General Counsel)", email: "gc@example.com" },
    });
    if (!parsed.success || !c.summary.trim()) return Response.json({ error: "Describe what the company does" }, { status: 400 });
    customProfile = parsed.data;
  } else {
    const p = getCompany(body.profileId ?? "");
    if (p.use !== "demo") return Response.json({ error: "Only demo companies (or your own) are offered here; eval companies stay held out" }, { status: 400 });
  }

  const cell = cellByKey(uv.setup);
  if (!cell) return Response.json({ error: `userView.setup "${uv.setup}" is not a setup` }, { status: 500 });
  const cfg = cellConfig(cell, { profileId: customProfile ? "custom" : body.profileId!, windowStart: body.windowStart, windowEnd: body.windowEnd, asOf: body.windowEnd }, "user-view");
  const run = newRun({ ...cfg, arena: undefined, group: "user-view", customProfile });
  await saveRun(run);
  after(() => execute(run));
  return Response.json({ id: run.id });
}
