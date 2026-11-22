"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { FormErrors, ProfileForm } from "@/lib/runs/profileForm";
import { cn } from "@/lib/utils";

/** In scope / Out of scope: removable chips plus an "Add" popover with one text input. */
function ChipList({ id, label, items, tone, onChange }: { id: string; label: string; items: string[]; tone: "in" | "out"; onChange: (items: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (text) onChange([...items, text]);
    setDraft("");
    setOpen(false);
  };
  const chip = tone === "in" ? "bg-status-blue-surface text-status-blue-fg" : "bg-status-neutral-surface text-status-neutral-fg";
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span id={`${id}-label`} className="font-medium">
        {label}
      </span>
      <ul aria-labelledby={`${id}-label`} className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {items.map((item, i) => (
          <li key={`${i}-${item}`} className={cn("inline-flex max-w-full items-center gap-0.5 rounded-full py-0.5 pr-0.5 pl-2.5", chip)}>
            <span className="min-w-0 break-words">{item}</span>
            <button
              type="button"
              aria-label={`Remove "${item}" from ${label.toLowerCase()}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-nav-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden="true" className="size-3" />
            </button>
          </li>
        ))}
        <li>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              aria-label={`Add to ${label.toLowerCase()}`}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 text-muted-foreground hover:bg-nav-hover focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus aria-hidden="true" className="size-3" />
              Add
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
              <form
                className="flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <label htmlFor={`${id}-new`} className="text-[13px] font-medium">
                  Add to {label.toLowerCase()}
                </label>
                <Input id={`${id}-new`} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} className="h-8 rounded-md" />
                <Button type="submit" size="sm" className="self-end">
                  Add
                </Button>
              </form>
            </PopoverContent>
          </Popover>
        </li>
      </ul>
    </div>
  );
}

function FieldError({ id, children }: { id: string; children: string | undefined }) {
  return children ? (
    <p id={id} role="alert" className="m-0 text-[13px] text-status-red-fg">
      {children}
    </p>
  ) : null;
}

/** "What <company> cares about": name, description, scope chips and the owners table (passed in), collapsible. */
export function ProfileEditor({
  title,
  form,
  errors,
  onChange,
  owners,
}: {
  title: string;
  form: ProfileForm;
  errors: FormErrors;
  onChange: (form: ProfileForm) => void;
  owners: ReactNode;
}) {
  return (
    <Collapsible defaultOpen className="rounded-lg border border-border">
      <CollapsibleTrigger className="group flex w-full flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-border-subtle bg-transparent px-4 py-3.5 text-left focus-visible:outline-2 focus-visible:outline-ring">
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-0 -rotate-90" />
        <span className="min-w-0 grow basis-48 font-semibold">{title}</span>
        <span className="text-[13px] text-muted-foreground">Edits make this your own profile</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-[18px] p-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="company-name" className="font-medium">
            Company name
          </label>
          <Input
            id="company-name"
            value={form.name}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? "company-name-error" : undefined}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="h-9 rounded-md bg-card"
          />
          <FieldError id="company-name-error">{errors.name}</FieldError>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="what" className="font-medium">
            What the company does
          </label>
          <Textarea
            id="what"
            rows={3}
            value={form.summary}
            aria-invalid={errors.summary ? true : undefined}
            aria-describedby={errors.summary ? "what-error" : undefined}
            onChange={(e) => onChange({ ...form, summary: e.target.value })}
            className="rounded-md bg-card leading-relaxed"
          />
          <FieldError id="what-error">{errors.summary}</FieldError>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChipList id="in-scope" label="In scope" tone="in" items={form.applies} onChange={(applies) => onChange({ ...form, applies })} />
          <ChipList id="out-scope" label="Out of scope" tone="out" items={form.doesNotApply} onChange={(doesNotApply) => onChange({ ...form, doesNotApply })} />
        </div>
        {owners}
      </CollapsibleContent>
    </Collapsible>
  );
}
