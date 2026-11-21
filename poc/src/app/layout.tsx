import type { Metadata } from "next";
import Link from "next/link";
import { BUDGET_USD, spentUsd } from "@/lib/store";
import "./globals.css";

export const metadata: Metadata = { title: "Reg Monitor POC", description: "Lo-fi POC: regulatory triage pipeline, baseline and evals" };

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const spent = await spentUsd();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line px-4 py-2 flex items-center gap-6 text-sm">
          <span className="font-semibold">Reg Monitor · POC</span>
          <nav className="flex gap-4">
            <Link href="/">Run</Link>
            <Link href="/label">Label</Link>
            <Link href="/evals">Evals</Link>
          </nav>
          <span className="ml-auto font-mono text-xs text-muted">
            spend ${spent.toFixed(2)} / ${BUDGET_USD}
          </span>
        </header>
        <main className="px-4 py-4 max-w-6xl mx-auto">{children}</main>
      </body>
    </html>
  );
}
