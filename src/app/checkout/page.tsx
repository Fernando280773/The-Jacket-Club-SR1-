import type { Metadata } from "next";
import Link from "next/link";
import { BasketProvider } from "@/components/BasketProvider";
import { getMenu } from "@/lib/menu";
import { pickupSlots } from "@/lib/slots";
import { orderingOpen } from "@/lib/server/ordering";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout · The Jacket Club SR1" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const result = await getMenu();
  if (!result.ok) throw new Error(result.error);
  const now = new Date();

  return (
    <BasketProvider menu={result.menu}>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link href="/basket" aria-label="Back to basket" className="flex h-9 w-9 items-center justify-center rounded-full bg-club-cream font-bold">
            ←
          </Link>
          <h1 className="font-display text-2xl text-club-green">Checkout</h1>
        </header>
        {cancelled && (
          <p role="status" data-testid="payment-cancelled" className="mb-4 rounded-xl bg-club-cream px-4 py-3 text-sm font-bold">
            Payment cancelled. You haven&apos;t been charged, and your basket is still here.
          </p>
        )}
        {orderingOpen(now) ? (
          <CheckoutForm slots={pickupSlots(result.menu.hours, now)} />
        ) : (
          <p className="py-8 text-center font-bold">Ordering opens 10 December.</p>
        )}
      </main>
    </BasketProvider>
  );
}
