import type { Metadata } from "next";
import Link from "next/link";
import { BasketProvider } from "@/components/BasketProvider";
import { getMenu } from "@/lib/menu";
import { orderingOpen } from "@/lib/server/ordering";
import { staffTestActive } from "@/lib/server/staff-test";
import { BasketView } from "./BasketView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your basket · The Jacket Club SR1" };

export default async function BasketPage() {
  const result = await getMenu({ fresh: true });
  const staffTest = await staffTestActive();
  if (!result.ok && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(result.error);
  if (!result.ok) return <main className="p-4">Sorry, the basket could not be loaded right now.</main>;

  return (
    <BasketProvider menu={result.menu}>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link href="/" aria-label="Back to menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-club-cream font-bold">
            ←
          </Link>
          <h1 className="font-display text-2xl text-club-green">Your basket</h1>
        </header>
        <BasketView canOrder={orderingOpen(new Date(), result.menu.acceptingOrders, staffTest)} paused={!result.menu.acceptingOrders} pausedMessage={result.menu.pausedMessage} />
      </main>
    </BasketProvider>
  );
}
