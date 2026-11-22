// Projects the finished example runs of the eval bundle (public/evals/user-view/runs/<id>.json, POC RunRecords) into
// the public files the GC's example pages read: public/examples/index.json and public/examples/<id>.json. GC pages
// never read public/evals/ (setup and model ids, stage ids, prompts and Gateway errors live there).
//
//   bash scripts/build-examples.sh
//
// The projection is src/lib/pipeline/recorded.ts (projectRecordedRun): public RunEvents only, each through
// assertPublic, the neutral reason in place of the POC's leaked relevance score. Run under the react-server condition
// (the wrapper passes it), because that module and src/lib/config.ts import `server-only`.
//
// Idempotent: the output depends only on the bundle and config/, has no timestamps, is written in a fixed order, and
// replaces public/examples/ entirely, so a rebuild from unchanged inputs leaves git status clean. Reads only; calls no
// model and no network.
import fs from "node:fs";
import path from "node:path";
import { exampleIndex, projectExamples } from "../src/lib/pipeline/recorded";

const ROOT = process.cwd();
const USER_VIEW = path.join(ROOT, "public/evals/user-view");
const OUT = path.join(ROOT, "public/examples");

const listing = JSON.parse(fs.readFileSync(path.join(USER_VIEW, "runs-index.json"), "utf8")) as { runId: string; status: string }[];
const examples = projectExamples(listing, (runId) => JSON.parse(fs.readFileSync(path.join(USER_VIEW, "runs", `${runId}.json`), "utf8")));

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const ex of examples) fs.writeFileSync(path.join(OUT, `${ex.id}.json`), `${JSON.stringify(ex, null, 2)}\n`);
fs.writeFileSync(path.join(OUT, "index.json"), `${JSON.stringify(exampleIndex(examples), null, 2)}\n`);
console.log(`public/examples: ${examples.length} examples of ${listing.length} recorded runs (${listing.length - examples.length} failed, not listed)`);
