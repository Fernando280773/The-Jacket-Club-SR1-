"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMPANY, LEGAL_PAGES } from "@/lib/company";

const STAFF_PAGES = ["/kitchen", "/admin", "/driver"];

/** Legal links and company details on every customer page (not on staff screens). */
export function SiteFooter() {
  const path = usePathname() ?? "/";
  if (STAFF_PAGES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return (
    <footer data-testid="site-footer" className="mx-auto max-w-xl border-t border-club-line px-4 pt-6 pb-32 text-xs text-club-muted">
      <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-2 font-bold">
        {LEGAL_PAGES.map((p) => (
          <Link key={p.href} href={p.href} className="text-club-green underline">
            {p.label}
          </Link>
        ))}
        <a href={`mailto:${COMPANY.email}`} className="text-club-green underline">
          {COMPANY.email}
        </a>
      </nav>
      <p className="mt-3">
        {COMPANY.tradingName}, {COMPANY.shopAddress}. {COMPANY.tradingName} is a trading name of {COMPANY.legalName}, registered in {COMPANY.registeredIn}, company
        number {COMPANY.number}. Registered office: {COMPANY.registeredOffice}.
      </p>
    </footer>
  );
}
