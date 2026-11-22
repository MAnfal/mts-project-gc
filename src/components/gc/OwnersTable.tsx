"use client";

import { LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AreaRow } from "@/lib/runs/profileForm";

const cell = "h-8 rounded-md bg-card";

/**
 * "Who owns what": one row per area (Area | Covers | Owner), each cell an input. Below 640 px each row stacks into a
 * small card, so the table never scrolls sideways. `note` (under the table) says where unclaimed items go.
 */
export function OwnersTable({
  rows,
  onChange,
  onAdd,
  onSuggest,
  suggesting,
  suggestError,
  error,
  note,
}: {
  rows: AreaRow[];
  onChange: (rows: AreaRow[]) => void;
  onAdd: () => void;
  onSuggest: () => void;
  suggesting: boolean;
  suggestError: string | null;
  error: string | undefined;
  note: string;
}) {
  const set = (rowId: string, change: Partial<AreaRow>) => onChange(rows.map((r) => (r.rowId === rowId ? { ...r, ...change } : r)));
  const field = (r: AreaRow, i: number, k: "area" | "covers" | "owner", label: string, placeholder: string) => {
    const id = `${r.rowId}-${k}`;
    return (
      <>
        <label htmlFor={id} className="sr-only">
          {`${label}, area ${i + 1}`}
        </label>
        <Input id={id} value={r[k]} placeholder={placeholder} aria-invalid={k === "area" && error ? true : undefined} onChange={(e) => set(r.rowId, { [k]: e.target.value })} className={cell} />
      </>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <span id="owners-label" className="font-medium">
        Who owns what
      </span>
      {rows.length ? (
        <div className="rounded-lg border border-border">
          <Table aria-labelledby="owners-label" className="max-sm:block">
            <TableHeader className="max-sm:sr-only">
              <TableRow className="bg-secondary hover:bg-secondary">
                <TableHead className="px-3 font-semibold">Area</TableHead>
                <TableHead className="px-3 font-semibold">Covers</TableHead>
                <TableHead className="px-3 font-semibold">Owner</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="max-sm:block">
              {rows.map((r, i) => (
                <TableRow
                  key={r.rowId}
                  className="border-row-border hover:bg-transparent max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-1.5 max-sm:p-2"
                >
                  <TableCell className="px-2 py-1.5 whitespace-normal max-sm:col-start-1 max-sm:p-0">{field(r, i, "area", "Area name", "Area")}</TableCell>
                  <TableCell className="px-2 py-1.5 whitespace-normal max-sm:col-start-1 max-sm:p-0">{field(r, i, "covers", "What it covers", "Covers")}</TableCell>
                  <TableCell className="px-2 py-1.5 whitespace-normal max-sm:col-start-1 max-sm:p-0">{field(r, i, "owner", "Owner", "Owner (blank: you)")}</TableCell>
                  <TableCell className="w-10 px-1 py-1.5 max-sm:col-start-2 max-sm:row-start-1 max-sm:p-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove area ${r.area.trim() || i + 1}`}
                      onClick={() => onChange(rows.filter((x) => x.rowId !== r.rowId))}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-[13px] text-status-red-fg">
          {error}
        </p>
      ) : null}
      <p className="m-0 text-[13px] text-muted-foreground">{note}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="h-8 bg-card" onClick={onAdd}>
          <Plus aria-hidden="true" />
          Add area
        </Button>
        <Button variant="outline" size="sm" className="h-8 bg-card" onClick={onSuggest} disabled={suggesting}>
          {suggesting ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Sparkles aria-hidden="true" />}
          {suggesting ? "Suggesting…" : "Suggest from description"}
        </Button>
      </div>
      {suggestError ? (
        <p role="alert" className="m-0 text-[13px] text-status-red-fg">
          {suggestError}
        </p>
      ) : null}
    </div>
  );
}
