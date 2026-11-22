import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { BookingSummary } from "@/components/BookingSummary";
import { confirmBookingSession, sendBookingEmailOnce } from "@/lib/server/bookings";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Table booked · The Jacket Club SR1", robots: { index: false } };

export default async function BookingConfirmedPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const result = session_id ? await confirmBookingSession(session_id) : null;

  if (!result || !result.ok) {
    const reason = result && !result.ok ? result.reason : "error";
    const text =
      reason === "unpaid"
        ? "Your payment didn't go through, so nothing is booked and you haven't been charged."
        : reason === "conflict"
          ? "Sorry, those tables were taken while you were paying. Your deposit has been refunded in full. Please pick another time."
          : "If you were charged, your booking is safe: we confirm every payment with Stripe. Please contact info@thejacketclubsr1.com.";
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl text-club-green">{reason === "unpaid" ? "Payment not completed" : reason === "conflict" ? "Time no longer free" : "Checking your booking"}</h1>
        <p>{text}</p>
        <Link href="/book" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
          Back to booking
        </Link>
      </main>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  await sendBookingEmailOnce(result.booking.id, origin);
  const b = result.booking;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8 text-center">
      <p className="text-4xl" aria-hidden="true">
        ✓
      </p>
      <h1 data-testid="booking-confirmed" className="font-display text-3xl text-club-green">
        You&apos;re booked{b.customer_name ? `, ${b.customer_name.split(" ")[0]}` : ""}!
      </h1>
      <BookingSummary b={b} />
      <p className="text-sm text-club-muted">{b.customer_email ? `A confirmation is on its way to ${b.customer_email}.` : ""} Scan the QR code on your table to order; your deposit comes off.</p>
      <Link href={`/booking/${b.access_token}`} data-testid="manage-booking" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
        Manage booking
      </Link>
      <Link href="/" className="font-bold text-club-green underline">
        See the menu
      </Link>
    </main>
  );
}
