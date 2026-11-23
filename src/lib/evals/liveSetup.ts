import "server-only";
import { buildRunConfig } from "@/app/api/run/run-config";
import { experiment, pipelineCfg, prompts, setups, withPromptSet, type PipelineCfg, type PromptName } from "@/lib/config";
import type { RunConfig } from "@/lib/types";

export type PromptView = {
  name: PromptName;
  /** The template a live run uses ({{placeholders}} are filled per run). */
  text: string;
  /** The default (config/prompts.yaml) it replaced, when the live prompt set overrides it; otherwise null. */
  defaultText: string | null;
};
export type StageId = "screen" | "filter" | "extract" | "actions";
export type LiveSetupView = {
  setup: { id: string; label: string };
  model: { id: string; label: string; vendor: string };
  method: { id: string; label: string };
  filter: RunConfig["filter"];
  jevModel: string;
  jevThreshold: number;
  promptSet: string | null;
  filterVotes: number;
  filterExcerpts: NonNullable<RunConfig["filterExcerpts"]> | null;
  webLeads: boolean;
  tiering: PipelineCfg["tiering"];
  stages: { id: StageId; prompts: PromptView[] }[];
};

const STAGE_PROMPTS: Record<StageId, PromptName[]> = {
  screen: ["jevQuestion", "jevState"],
  filter: ["filterSystem", "filterPrompt"],
  extract: ["extractSystem", "extractPrompt"],
  actions: ["actionsSystem", "actionsPrompt"],
};

/**
 * What every GC run executes today, for /evals/setup. The decision fields come from buildRunConfig (the function
 * /api/run uses), so the page can't drift from a live run; the prompts are resolved the way a run resolves them
 * (config/prompts.yaml with the setup's prompt set applied, via withPromptSet). Server-only: it names the model.
 */
export async function liveSetupView(): Promise<LiveSetupView> {
  // Any window: only the setup-level fields are read, never the request's own.
  const run = buildRunConfig({ profileId: "-", windowStart: "-", windowEnd: "-" });
  const { setups: all, models, methods } = setups();
  const cell = all.find((s) => s.id === experiment().userView.setup)!;
  const model = models.find((m) => m.id === run.model)!;
  const method = methods.find((m) => m.id === cell.method)!;

  const base = prompts();
  const live = await withPromptSet(run.promptSet, async () => prompts());
  const stageIds = (Object.keys(STAGE_PROMPTS) as StageId[]).filter((s) => !(s === "screen" && run.filter === "llm") && !(s === "filter" && run.filter === "jev"));

  return {
    setup: { id: cell.id, label: cell.label },
    model: { id: model.id, label: model.label, vendor: model.vendor },
    method: { id: method.id, label: method.label },
    filter: run.filter,
    jevModel: experiment().jevModel,
    jevThreshold: run.jevThreshold,
    promptSet: run.promptSet ?? null,
    filterVotes: run.filterVotes ?? 1,
    filterExcerpts: run.filterExcerpts ?? null,
    webLeads: run.webLeads,
    tiering: pipelineCfg().tiering,
    stages: stageIds.map((id) => ({
      id,
      prompts: STAGE_PROMPTS[id].map((name) => ({ name, text: live[name], defaultText: live[name] === base[name] ? null : base[name] })),
    })),
  };
}

/** The {{placeholders}} config/eval-story.yaml → liveSetup may use, as display strings. */
export function liveSetupContext(v: LiveSetupView): Record<string, string> {
  const x = v.filterExcerpts;
  return {
    "setup.id": v.setup.id,
    "setup.label": v.setup.label,
    "model.label": v.model.label,
    "model.vendor": v.model.vendor,
    "method.label": v.method.label,
    jevModel: v.jevModel,
    jevThreshold: String(v.jevThreshold),
    promptSet: v.promptSet ?? "default",
    filterVotes: String(v.filterVotes),
    "passages.topN": x ? String(x.topN) : "—",
    "passages.perDoc": x ? String(x.perDoc) : "—",
    "passages.chunkChars": x ? x.chunkChars.toLocaleString("en-US") : "—",
    "tiering.criticalWindowDays": String(v.tiering.criticalWindowDays),
  };
}
