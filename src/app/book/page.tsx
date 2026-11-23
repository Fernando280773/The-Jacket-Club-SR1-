import type { Metadata } from "next";
import Link from "next/link";
import { bookingDates } from "@/lib/bookings";
import { formatPence } from "@/lib/money";
import { bookingContext } from "@/lib/server/bookings";
import { orderingOpen } from "@/lib/server/ordering";
import { staffTestActive } from "@/lib/server/staff-test";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Book a table · The Jacket Club SR1" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const { cancelled } = await searchParams;
  const ctx = await bookingContext();
  const now = new Date();
  const staffTest = await staffTestActive();
  const { rules } = ctx;

  return (
    <main className="mx-auto max-w-xl px-4 pb-16">
      <header className="flex items-center gap-3 py-4">
        <Link href="/" aria-label="Back to menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-club-cream font-bold">
          ←
        </Link>
        <h1 className="font-display text-2xl text-club-green">Book a table</h1>
      </header>
      <p className="mb-4 text-sm text-club-muted">
        Tables are booked for {rules.slotMinutes / 60} hours. A {formatPence(rules.depositPerPersonPence)} per person deposit holds your table and comes off your bill when you order at your
        table. Cancel at least {rules.refundNoticeHours} hours before for a full refund.
      </p>
      {cancelled && (
        <p role="status" data-testid="booking-cancelled" className="mb-4 rounded-xl bg-club-cream px-4 py-3 text-sm font-bold">
          Payment cancelled. You haven&apos;t been charged and nothing is booked.
        </p>
      )}
      {orderingOpen(now, true, staffTest) ? (
        <BookingForm dates={bookingDates(now, rules.daysAhead)} maxParty={rules.maxParty} depositPerPersonPence={rules.depositPerPersonPence} />
      ) : (
        <p className="py-8 text-center font-bold">Bookings open on 10 December.</p>
      )}
    </main>
  );
}
