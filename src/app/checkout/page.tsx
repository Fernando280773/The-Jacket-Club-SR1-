import type { Metadata } from "next";
import Link from "next/link";
import { BasketProvider } from "@/components/BasketProvider";
import { getMenu } from "@/lib/menu";
import { deliverySlots } from "@/lib/delivery";
import { pickupSlots } from "@/lib/slots";
import { orderingOpen } from "@/lib/server/ordering";
import { staffTestActive } from "@/lib/server/staff-test";
import { CheckoutForm } from "./CheckoutForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Checkout · The Jacket Club SR1" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const result = await getMenu({ fresh: true });
  if (!result.ok) throw new Error(result.error);
  const now = new Date();
  const staffTest = await staffTestActive();

  return (
    <BasketProvider menu={result.menu}>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link href="/basket" aria-label="Back to basket" className="flex h-9 w-9 items-center justify-center rounded-full bg-club-cream font-bold">
            ←
          </Link>
          <h1 className="font-display text-2xl text-club-green">Checkout</h1>
        </header>
        {staffTest && (
          <p role="status" data-testid="staff-test-banner" className="mb-4 rounded-xl bg-club-ink px-4 py-3 text-sm font-bold text-club-paper">
            Staff test mode: this is a real payment, marked STAFF TEST in the kitchen.
          </p>
        )}
        {cancelled && (
          <p role="status" data-testid="payment-cancelled" className="mb-4 rounded-xl bg-club-cream px-4 py-3 text-sm font-bold">
            Payment cancelled. You haven&apos;t been charged, and your basket is still here.
          </p>
        )}
        {!result.menu.acceptingOrders ? (
          <p data-testid="ordering-paused" className="py-8 text-center font-bold">
            We&apos;re not taking online orders right now.{result.menu.pausedMessage ? ` ${result.menu.pausedMessage}` : ""}
          </p>
        ) : orderingOpen(now, true, staffTest) ? (
          <CheckoutForm slots={pickupSlots(result.menu.hours, now)} deliverySlots={deliverySlots(result.menu.hours, now)} />
        ) : (
          <p className="py-8 text-center font-bold">Ordering opens 10 December.</p>
        )}
      </main>
    </BasketProvider>
  );
}
