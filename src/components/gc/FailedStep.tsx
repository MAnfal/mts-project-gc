import { RotateCw, SlidersHorizontal, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Under a failed step, or a run that failed outside any step (design/HiStates.dc.html, third panel): the message,
 * "Retry" (re-posts the whole run with the same settings: the message says so) and "Edit settings" (the new-run
 * screen filled from this run). Either action is shown only when given. `alert` adds the warning icon, for a failure
 * shown on its own rather than under a step that already carries the failed icon.
 */
export function FailedStep({
  message,
  onRetry,
  retrying = false,
  editHref,
  alert = false,
}: {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  editHref?: string;
  alert?: boolean;
}) {
  return (
    <div className="flex flex-col items-start gap-2.5 rounded-md bg-status-red-surface px-3.5 py-3 text-status-red-fg">
      <p className="m-0 flex gap-2">
        {alert ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
        {message}
      </p>
      {onRetry || editHref ? (
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <Button onClick={onRetry} disabled={retrying}>
              <RotateCw aria-hidden="true" />
              {retrying ? "Starting…" : "Retry"}
            </Button>
          ) : null}
          {editHref ? (
            <Link href={editHref} className={cn(buttonVariants({ variant: "outline" }), "bg-card text-foreground no-underline hover:text-foreground")}>
              <SlidersHorizontal aria-hidden="true" />
              Edit settings
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
