import { connection } from "next/server";
import { arenaRuns } from "@/lib/arena";
import SuiteView from "./SuiteView";

/** Interviewer dashboard for one eval suite (all setups × all eval sets). */
export default async function ArenaPage({ params, searchParams }: PageProps<"/arena/[id]">) {
  await connection();
  const { id } = await params;
  const set = (await searchParams).set as string | undefined;
  const runs = await arenaRuns(id);
  if (!runs.length) return <p>Eval suite not found.</p>;
  return <SuiteView id={id} runs={runs} set={set} />;
}
