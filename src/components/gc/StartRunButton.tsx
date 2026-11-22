"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { RunRequest } from "@/lib/runs/types";
import type { CompanyProfile } from "@/lib/types";
import { startRun } from "./useRun";

/**
 * Starts `request` (saving `profile` with it) and opens the run's page while it streams. `disabled` while the screen
 * has something to fix; `beforeStart` runs first (the new-run screen saves the GC's own profile there).
 */
export function StartRunButton({
  request,
  profile,
  disabled = false,
  beforeStart,
  children,
}: {
  request: RunRequest | null;
  profile: CompanyProfile | null;
  disabled?: boolean;
  beforeStart?: () => Promise<void>;
  children: ReactNode;
}) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  return (
    <Button
      disabled={disabled || starting || !request || !profile}
      onClick={async () => {
        if (!request || !profile) return;
        setStarting(true);
        await beforeStart?.();
        router.push(`/runs/${await startRun(request, profile)}`);
      }}
    >
      <Play aria-hidden="true" />
      {starting ? "Starting…" : children}
    </Button>
  );
}
