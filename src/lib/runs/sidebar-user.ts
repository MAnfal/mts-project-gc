import type { CompanyProfile } from "../types";
import { ownerName } from "./report";

/** The sidebar footer's user: the first preset's general counsel ("Jordan Blake", "General Counsel, Ledgerly"). */
export function sidebarUser(presets: CompanyProfile[]): { name: string; role: string } | null {
  const p = presets[0];
  if (!p) return null;
  const role = p.generalCounsel.name.match(/\(([^)]*)\)\s*$/)?.[1] ?? "General Counsel";
  return { name: ownerName(p.generalCounsel), role: `${role}, ${p.name.split(/\s+/)[0]}` };
}
