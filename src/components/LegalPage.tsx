import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_UPDATED } from "@/lib/company";

/** Shared layout for the legal pages: readable width, plain headings, last-updated date. */
export function LegalPage({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Link href="/" className="text-sm font-bold text-club-green underline">
        ← Back to menu
      </Link>
      <h1 className="mt-3 font-display text-3xl text-club-green">{title}</h1>
      <p className="mt-1 text-xs text-club-muted">Last updated {LEGAL_UPDATED}</p>
      {intro && <div className="mt-4 text-base">{intro}</div>}
      <div className="legal mt-4 flex flex-col gap-3 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-lg [&_h2]:text-club-green [&_li]:ml-5 [&_li]:list-disc [&_a]:font-bold [&_a]:text-club-green [&_a]:underline">
        {children}
      </div>
    </main>
  );
}
