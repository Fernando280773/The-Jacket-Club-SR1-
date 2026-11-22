import Link from "next/link";
import type { MenuCategory } from "@/lib/menu";

/** Sticky row of category links; each jumps to its section. */
export function CategoryTabs({ categories }: { categories: MenuCategory[] }) {
  return (
    <nav aria-label="Menu categories" className="sticky top-0 z-10 -mx-4 border-b border-club-line bg-club-paper/95 backdrop-blur">
      <ul className="flex gap-2 overflow-x-auto px-4 py-3 [scrollbar-width:none]">
        {categories.map((c) => (
          <li key={c.slug} className="shrink-0">
            <a
              href={`#${c.slug}`}
              className="block rounded-full border border-club-line px-3 py-1.5 text-sm font-bold whitespace-nowrap hover:bg-club-cream"
            >
              {c.name}
            </a>
          </li>
        ))}
        <li className="shrink-0">
          <Link href="/allergens" className="block rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap text-club-green underline">
            Allergens
          </Link>
        </li>
      </ul>
    </nav>
  );
}
