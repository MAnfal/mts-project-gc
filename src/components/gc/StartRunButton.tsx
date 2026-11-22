"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { RunRequest } from "@/lib/runs/types";
import type { CompanyProfile } from "@/lib/types";
import { startRun } from "./useRun";

/** Starts `request` (saving `profile` with it) and opens the run's page while it streams. */
export function StartRunButton({ request, profile, children }: { request: RunRequest; profile: CompanyProfile; children: ReactNode }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  return (
    <Button
      disabled={starting}
      onClick={async () => {
        setStarting(true);
        router.push(`/runs/${await startRun(request, profile)}`);
      }}
    >
      <Play aria-hidden="true" />
      {starting ? "Starting…" : children}
    </Button>
  );
}
