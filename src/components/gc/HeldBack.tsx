"use client";

import { ExternalLink, Plus, TriangleAlert } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { DocNote } from "@/lib/pipeline/events";
import { frDocUrl } from "@/lib/runs/reduce";
import { cn } from "@/lib/utils";

/**
 * Items that looked relevant but failed verification (design/HiStates.dc.html, second panel), shown above the report
 * table. They never enter the table on their own (Principle 3); "Add after checking" is the GC's own confirmation, and
 * only offered when `onConfirm` is given (a recorded example is read-only).
 */
export function HeldBack({ items, onConfirm }: { items: DocNote[]; onConfirm?: (documentNumber: string) => void }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="held-back" className="flex flex-col gap-2.5">
      <h2 id="held-back" className="m-0 text-[17px] font-semibold text-heading">
        {items.length} {items.length === 1 ? "item" : "items"} held back for you to check
      </h2>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {items.map((d) => (
          <li key={d.document_number} className="flex flex-col gap-2 rounded-md bg-status-orange-surface p-3.5 text-status-orange-fg">
            <div className="flex items-start gap-2 font-semibold">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0 [overflow-wrap:anywhere]">{d.title}</span>
            </div>
            <p className="m-0 leading-relaxed">{d.reason} It stays out of the report until you confirm it.</p>
            <div className="mt-0.5 flex flex-wrap gap-2">
              <a
                href={frDocUrl(d.document_number)}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: "outline" }), "bg-card text-status-orange-fg no-underline hover:text-status-orange-fg")}
              >
                Open on Federal Register
                <ExternalLink aria-hidden="true" />
              </a>
              {onConfirm ? (
                <Button className="bg-status-orange-fg text-status-orange-surface hover:bg-status-orange-fg/90" onClick={() => onConfirm(d.document_number)}>
                  <Plus aria-hidden="true" />
                  Add after checking
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
