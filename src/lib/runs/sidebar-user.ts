import type { CompanyProfile } from "../types";
import { ownerName } from "./report";

/** The sidebar footer's user: the general counsel of preset `preferId`, else of the first preset ("Jordan Blake", "General Counsel, Ledgerly"). */
export function sidebarUser(presets: CompanyProfile[], preferId?: string): { name: string; role: string } | null {
  const p = presets.find((x) => x.id === preferId) ?? presets[0];
  if (!p) return null;
  const role = p.generalCounsel.name.match(/\(([^)]*)\)\s*$/)?.[1] ?? "General Counsel";
  return { name: ownerName(p.generalCounsel), role: `${role}, ${p.name.split(/\s+/)[0]}` };
}
