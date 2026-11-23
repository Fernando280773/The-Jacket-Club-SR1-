"use server";

import { headers } from "next/headers";
import { bookingWhen, type StartTime } from "@/lib/bookings";
import { checkDetails, normaliseUkMobile } from "@/lib/checkout";
import { adminClient } from "@/lib/server/admin";
import { cancelByCustomer, freeStartTimes, holdTables } from "@/lib/server/bookings";
import { orderingOpen } from "@/lib/server/ordering";
import { staffTestActive } from "@/lib/server/staff-test";
import { paymentsConfigured, stripe } from "@/lib/server/stripe";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Free start times for a date and party size. */
export async function bookingTimes(date: string, party: number): Promise<{ ok: true; times: StartTime[] } | { ok: false; error: string }> {
  if (!DATE.test(String(date)) || !Number.isInteger(party)) return { ok: false, error: "Pick a date and party size." };
  try {
    return { ok: true, times: await freeStartTimes(date, party) };
  } catch {
    return { ok: false, error: "Couldn't load times. Please try again." };
  }
}

export type StartBookingInput = { date: string; startIso: string; party: number; name: string; phone: string; email: string };
export type StartBookingResult = { ok: true; url: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Holds the tables, then opens Stripe's page for the deposit. The booking is confirmed only when Stripe says it's paid. */
export async function startBooking(input: StartBookingInput): Promise<StartBookingResult> {
  if (!orderingOpen(new Date(), true, await staffTestActive())) return { ok: false, error: "Bookings open on 10 December." };
  const details = { name: String(input.name ?? ""), phone: String(input.phone ?? ""), email: String(input.email ?? "") };
  const fieldErrors = checkDetails(details);
  if (!details.email.trim()) fieldErrors.email = "Please enter your email for your booking confirmation";
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Please check your details.", fieldErrors };
  if (!DATE.test(String(input.date)) || typeof input.startIso !== "string" || !Number.isInteger(input.party)) return { ok: false, error: "Pick a date, time and party size." };
  if (!paymentsConfigured()) return { ok: false, error: "Payments are not set up on this site yet." };

  const hold = await holdTables({ date: input.date, startIso: input.startIso, party: input.party, name: details.name.trim(), phone: normaliseUkMobile(details.phone)!, email: details.email.trim() });
  if (!hold.ok) return { ok: false, error: hold.error };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: hold.depositPence,
            product_data: { name: `Table booking deposit · ${input.party} ${input.party === 1 ? "person" : "people"}`, description: `${bookingWhen(input.startIso)} · taken off your bill when you order at your table` },
          },
        },
      ],
      customer_email: details.email.trim(),
      client_reference_id: hold.bookingId,
      metadata: { kind: "booking", booking_id: hold.bookingId },
      payment_intent_data: { metadata: { booking_id: hold.bookingId }, description: "The Jacket Club SR1 table booking deposit" },
      success_url: `${origin}/book/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    await adminClient().from("bookings").update({ stripe_session_id: session.id }).eq("id", hold.bookingId);
    if (!session.url) throw new Error("no url");
    return { ok: true, url: session.url };
  } catch {
    await adminClient().rpc("close_booking", { p_booking_id: hold.bookingId, p_status: "cancelled", p_refunded_pence: 0, p_note: "Payment page failed to open" });
    return { ok: false, error: "Could not open the payment page. Please try again." };
  }
}

/** Customer cancels from the Manage booking page. */
export async function cancelMyBooking(token: string) {
  return cancelByCustomer(String(token));
}
