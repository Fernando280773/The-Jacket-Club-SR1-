import Image from "next/image";
import Link from "next/link";
import { CategoryTabs } from "@/components/CategoryTabs";
import { FavouriteCard, ItemCard } from "@/components/ItemCard";
import { OpenStatus } from "@/components/OpenStatus";
import { OrderTypes } from "@/components/OrderTypes";
import { getMenu } from "@/lib/menu";
import { isBeforeOpeningDay } from "@/lib/opening";

// The menu is rebuilt at most every 60 seconds, so price changes show within a minute.
// Open/closed is worked out live in the browser (OpenStatus).
export const revalidate = 60;

export default async function MenuPage() {
  const result = await getMenu();
  // After the first build, a failed refresh keeps showing the last good menu instead of an error.
  if (!result.ok && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(result.error);

  if (!result.ok) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <Image src="/logo-512.png" alt="The Jacket Club SR1 logo" width={120} height={120} className="rounded-full" />
        <h1 className="font-display text-2xl text-club-green">The Jacket Club SR1</h1>
        <p data-testid="menu-error">Sorry, the menu could not be loaded right now. Please try again in a minute.</p>
      </main>
    );
  }

  const { menu } = result;
  return (
    <main className="mx-auto max-w-xl px-4 pb-16">
      {isBeforeOpeningDay(new Date()) && (
        <p data-testid="opening-banner" className="-mx-4 bg-club-butter px-4 py-2 text-center text-sm font-bold text-club-ink">
          Ordering opens 10 December
        </p>
      )}

      <header className="flex items-center gap-3 py-4">
        <Image src="/logo-512.png" alt="The Jacket Club SR1 logo" width={56} height={56} priority className="rounded-full" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="font-display text-xl leading-tight text-club-green">{menu.shopName}</h1>
          <OpenStatus hours={menu.hours} />
        </div>
      </header>

      <OrderTypes />

      <CategoryTabs categories={menu.categories} />

      {menu.featured.length > 0 && (
        <section aria-labelledby="favourites" className="pt-5">
          <h2 id="favourites" className="font-display text-lg text-club-green">
            Club favourites
          </h2>
          <div className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {menu.featured.map((item) => (
              <FavouriteCard key={item.code} item={item} />
            ))}
          </div>
        </section>
      )}

      {menu.categories.map((c) => (
        <section key={c.slug} id={c.slug} aria-labelledby={`h-${c.slug}`} className="scroll-mt-16 pt-6">
          <h2 id={`h-${c.slug}`} className="font-display text-lg text-club-green">
            {c.name}
          </h2>
          {c.items.map((item) => (
            <ItemCard key={item.code} item={item} />
          ))}
        </section>
      ))}

      <footer className="flex flex-col gap-2 pt-8 text-sm text-club-muted">
        <p>All our food is 100% halal. Prices include VAT.</p>
        <p>
          Allergies? See our{" "}
          <Link href="/allergens" className="font-bold text-club-green underline">
            full allergen table
          </Link>{" "}
          and tell staff before you order.
        </p>
        <p>{menu.address}</p>
      </footer>
    </main>
  );
}
