// Re-records tests/fixtures/recorded-prompts.json from a finished arena's transcripts.
// Run after you deliberately change a prompt/company/knob AND have re-run an arena with it:
//   npx tsx scripts/record-prompt-fixtures.mts <arenaId>
// The prompt tests then pin the new wording, so a later accidental edit is caught.
import fs from "node:fs";
import { arenaRuns } from "../src/lib/arena";

const runs = (await arenaRuns(process.argv[2])).filter((r) => r.status === "done");
const pick = (cell: string) => {
  const r = runs.find((x) => x.config.cell === cell);
  if (!r) throw new Error(`arena has no finished run for ${cell}`);
  return r;
};
const call = (r: (typeof runs)[number], stage: string) => {
  const c = r.calls.find((x) => x.stage === stage);
  if (!c?.prompt) throw new Error(`${r.id} has no logged prompt for ${stage}`);
  return c.prompt;
};
const base = pick("baseline:anthropic/claude-sonnet-5.5");
const llm = pick("llm:anthropic/claude-sonnet-5.5");
const actions = call(llm, "output-actions");
const items = (llm.items ?? [])
  .map(({ document_number, type, title, tier, tierReason, owner, reason }) => ({ document_number, type, title, tier, tierReason, owner, reason }))
  .sort((a, b) => actions.indexOf(`[${a.document_number}]`) - actions.indexOf(`[${b.document_number}]`));
const fx = {
  baselineTask: { config: base.config, prompt: call(base, "baseline:search"), run: base.id },
  filterPrompt0: { profileId: llm.config.profileId, prompt: call(llm, "filter-llm#0"), run: llm.id },
  actionsPrompt: { profileId: llm.config.profileId, items, prompt: actions, run: llm.id },
  arenaConfigs: runs.map((r) => r.config),
};
fs.writeFileSync("tests/fixtures/recorded-prompts.json", JSON.stringify(fx, null, 1));
console.log(`recorded from ${runs.length} runs of ${process.argv[2]}`);
