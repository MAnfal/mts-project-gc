import { defaultEvalset, getCompany } from "@/lib/config";
import { profileBrief } from "@/lib/prompts";
import LabelBoard from "./LabelBoard";

export default async function LabelPage({ searchParams }: PageProps<"/label">) {
  const sp = await searchParams;
  const profileId = (sp.profile as string) ?? defaultEvalset().company;
  const start = (sp.start as string) ?? defaultEvalset().windowStart;
  const end = (sp.end as string) ?? defaultEvalset().windowEnd;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">Label ground truth · {start} → {end}</h1>
        <p className="text-sm text-muted-foreground">Tick every document the GC would want on their desk. Mark an agency &quot;reviewed&quot; once you&apos;ve looked at all its docs — unreviewed agencies make recall dishonest. No model output is shown here on purpose.</p>
      </div>
      <details className="box p-3 text-sm">
        <summary className="font-medium">Company profile</summary>
        <pre className="whitespace-pre-wrap text-xs mt-2">{profileBrief(getCompany(profileId))}</pre>
      </details>
      <LabelBoard profileId={profileId} start={start} end={end} />
    </div>
  );
}
