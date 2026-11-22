"use client";

import { Check } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { deadlineLabel, ownerName } from "@/lib/runs/report";
import type { ActionItem, CompanyProfile } from "@/lib/types";

const TYPE_LABEL: Record<ActionItem["type"], string> = { Rule: "Final rule", "Proposed Rule": "Proposed rule", Notice: "Notice", "Presidential Document": "Presidential document" };

/** Source n of the report: the table's numbered chips link here. */
export const sourceId = (n: number) => `source-${n}`;

/**
 * The right panel: Sources (each item's official record, numbered as in the table) and Profile (the profile the run
 * used, from the run's own snapshot, so it shows what was run even if the preset changes later).
 */
export function SourcesPanel({ items, profile }: { items: ActionItem[]; profile: CompanyProfile }) {
  return (
    <Tabs defaultValue="sources" className="gap-3.5">
      <TabsList className="grid h-9 w-full grid-cols-2 bg-nav-hover">
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="profile">Profile</TabsTrigger>
      </TabsList>
      <TabsContent value="sources">
        {items.length ? (
          <ol className="m-0 flex list-none flex-col gap-1 p-0">
            {items.map((item, i) => (
              <li key={item.document_number} id={sourceId(i + 1)} className="flex scroll-mt-4 gap-2.5 rounded-lg p-2.5 target:bg-background">
                <span className="mt-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-cite px-1 text-[10px] font-semibold text-heading">{i + 1}</span>
                <span className="flex min-w-0 flex-col gap-[3px]">
                  <span className="leading-snug font-semibold">{item.title}</span>
                  <span className="text-xs text-caption">
                    {[item.citation ?? item.document_number, TYPE_LABEL[item.type], item.agencies[0]].filter(Boolean).join(" · ")}
                    {item.citation && item.citationVerified ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-status-green-fg">
                        <Check aria-hidden="true" className="size-3" />
                        citation matched
                      </span>
                    ) : null}
                  </span>
                  {item.deadline?.quote ? <span className="text-xs text-muted-foreground">“{item.deadline.quote}”</span> : null}
                  {item.deadline ? <span className="text-xs text-muted-foreground">{Object.values(deadlineLabel(item.deadline)).join(" ")}</span> : null}
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-xs">
                    Open on Federal Register
                  </a>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-muted-foreground">Sources appear here as items are confirmed against the Federal Register.</p>
        )}
      </TabsContent>
      <TabsContent value="profile">
        <ProfileSummary profile={profile} />
      </TabsContent>
    </Tabs>
  );
}

function ProfileSummary({ profile }: { profile: CompanyProfile }) {
  const areas = Object.entries(profile.areas);
  return (
    <div className="flex flex-col gap-3.5 leading-relaxed">
      <div>
        <h2 className="m-0 text-sm font-semibold text-heading">{profile.name}</h2>
        <p className="m-0 mt-1 text-muted-foreground">{profile.summary}</p>
      </div>
      <List title="In scope" items={profile.applies} />
      <List title="Out of scope" items={profile.doesNotApply} />
      <div>
        <h3 className="m-0 mb-1 text-[11px] font-semibold tracking-[0.06em] text-caption uppercase">Who owns what</h3>
        {areas.length ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {areas.map(([id, a]) => (
              <li key={id}>
                <span className="font-medium">{ownerName(a.owner)}</span> <span className="text-muted-foreground">· {a.description}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-muted-foreground">No areas: every item goes to {ownerName(profile.generalCounsel)}.</p>
        )}
      </div>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 className="m-0 mb-1 text-[11px] font-semibold tracking-[0.06em] text-caption uppercase">{title}</h3>
      <ul className="m-0 flex list-disc flex-col gap-1 pl-4">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
