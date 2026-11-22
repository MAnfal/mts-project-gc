import { describe, expect, it } from "vitest";
import type { CompanyProfile } from "../types";
import { sidebarUser } from "./sidebar-user";

const profile = (gc: string, name = "Ledgerly Inc."): CompanyProfile => ({
  id: "x",
  name,
  summary: "",
  businessLines: [],
  applies: [],
  doesNotApply: [],
  areas: {},
  generalCounsel: { name: gc, email: "gc@example.com" },
});

describe("sidebarUser", () => {
  it("is the first preset's general counsel: name, then role and company", () => {
    expect(sidebarUser([profile("Jordan Blake (General Counsel)"), profile("Other (GC)", "Hearth")])).toEqual({ name: "Jordan Blake", role: "General Counsel, Ledgerly" });
  });

  it("falls back to 'General Counsel' when the name carries no role", () => {
    expect(sidebarUser([profile("Jordan Blake")])).toEqual({ name: "Jordan Blake", role: "General Counsel, Ledgerly" });
    expect(sidebarUser([profile("Sam Lee (Chief Legal Officer)", "Hearth Home Appliances")])).toEqual({ name: "Sam Lee", role: "Chief Legal Officer, Hearth" });
  });

  it("is null with no presets", () => {
    expect(sidebarUser([])).toBeNull();
  });
});
