import type { Metadata } from "next";
import Link from "next/link";
import { BookingSummary } from "@/components/BookingSummary";
import { refundDue } from "@/lib/bookings";
import { formatPence } from "@/lib/money";
import { bookingByToken, bookingContext } from "@/lib/server/bookings";
import { CancelBooking } from "./CancelBooking";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your booking · The Jacket Club SR1", robots: { index: false } };

const STATUS: Record<string, string> = {
  confirmed: "Booked",
  cancelled: "Cancelled",
  no_show: "Missed",
  completed: "Finished",
  pending_payment: "Waiting for payment",
};

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const b = await bookingByToken(token);
  if (!b) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 data-testid="booking-not-found" className="font-display text-2xl text-club-green">
          Booking not found
        </h1>
        <p>Please check the link in your confirmation email, or contact info@thejacketclubsr1.com.</p>
      </main>
    );
  }
  const { rules } = await bookingContext();
  const now = new Date();
  const canCancel = b.status === "confirmed" && new Date(b.starts_at) > now;
  const refundable = refundDue(b.starts_at, now, rules.refundNoticeHours);

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-8">
      <h1 className="text-center font-display text-3xl text-club-green">Your booking</h1>
      <p data-testid="booking-status" className="text-center text-lg font-bold">
        {STATUS[b.status] ?? b.status}
        {b.refunded_pence > 0 ? ` · ${formatPence(b.refunded_pence)} refunded` : ""}
      </p>
      <BookingSummary b={b} />
      {canCancel && <CancelBooking token={b.access_token} refundable={refundable} depositText={formatPence(b.deposit_pence)} noticeHours={rules.refundNoticeHours} />}
      <Link href="/" className="text-center font-bold text-club-green underline">
        See the menu
      </Link>
    </main>
  );
}
