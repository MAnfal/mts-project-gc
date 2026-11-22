"use client";

import { Building2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { Choice, PickerOption } from "@/lib/runs/new-run";

/**
 * "Company profile": presets (badged), this browser's saved profiles, and "New company…". `label` is the closed
 * picker's text, "(edited)" included; `confirm` is the inline question shown while a switch waits on unsaved edits.
 */
export function ProfilePicker({
  options,
  value,
  label,
  detail,
  focus,
  onPick,
  confirm,
  onDiscard,
  onKeep,
}: {
  options: PickerOption[];
  value: Choice;
  label: string;
  detail: string;
  /** Focus the picker on arrival (the sidebar's "Company profiles" link). */
  focus: boolean;
  onPick: (value: Choice) => void;
  confirm: string | null;
  onDiscard: () => void;
  onKeep: () => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) trigger.current?.focus();
  }, [focus]);
  const current = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="profile" className="font-medium">
        Company profile
      </label>
      <Select value={value} onValueChange={(v) => v && onPick(v as Choice)}>
        <SelectTrigger ref={trigger} id="profile" className="h-10 w-full gap-2.5 rounded-md bg-card px-3 text-left">
          <Building2 aria-hidden="true" className="text-caption" />
          <span className="min-w-0 flex-1 truncate">
            <b className="font-semibold">{label}</b> <span className="text-muted-foreground">· {detail}</span>
          </span>
          {current?.badge ? (
            <Badge className="bg-status-blue-surface font-normal text-status-blue-fg">{current.badge}</Badge>
          ) : null}
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} align="start">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="py-1.5">
              {o.badge ? <Building2 aria-hidden="true" className="text-caption" /> : null}
              <span className="truncate">{o.label}</span>
              {o.badge ? <span className="text-xs text-caption">{o.badge}</span> : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {confirm ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md bg-status-yellow-surface px-3 py-2.5 text-[13px] text-status-yellow-fg">
          <span className="min-w-0 flex-1 basis-60">{confirm}</span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onKeep}>
              Keep editing
            </Button>
            <Button size="sm" onClick={onDiscard}>
              Discard edits
            </Button>
          </span>
        </div>
      ) : null}
    </div>
  );
}
