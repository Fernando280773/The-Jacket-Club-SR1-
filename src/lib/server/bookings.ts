import { buildBookingEmail } from "../booking-email";
import {
  availableStarts,
  bookingWhen,
  depositCredit,
  depositPence,
  freeTables,
  HOLD_MINUTES,
  isBookableDate,
  pickTables,
  refundDue,
  startTimes,
  tablesNeeded,
  type BookableTable,
  type BookingRules,
  type BusyTable,
} from "../bookings";
import type { DayHours } from "../opening";
import { publicClient, SHOP_SLUG } from "../supabase";
import { adminClient } from "./admin";
import { emailConfigured, sendEmail } from "./email";
import { stripe } from "./stripe";

export type BookingContext = { shopId: string; hours: DayHours[]; rules: BookingRules; tables: BookableTable[] };

/** Shop hours, booking rules and the bookable tables (1–10). */
export async function bookingContext(): Promise<BookingContext> {
  const db = publicClient({ fresh: true }); // all public data: hours, rules, which tables can be booked
  const { data: shop, error } = await db
    .from("shops")
    .select(
      "id, opening_hours(iso_day, opens, closes), shop_settings(booking_slot_minutes, booking_days_ahead, booking_max_party, booking_deposit_per_person_pence, booking_refund_notice_hours), dining_tables(id, number, is_bookable)",
    )
    .eq("slug", SHOP_SLUG)
    .single();
  if (error || !shop) throw new Error(error?.message ?? "Shop not found");
  const s = (Array.isArray(shop.shop_settings) ? shop.shop_settings[0] : shop.shop_settings) as {
    booking_slot_minutes: number;
    booking_days_ahead: number;
    booking_max_party: number;
    booking_deposit_per_person_pence: number;
    booking_refund_notice_hours: number;
  };
  return {
    shopId: shop.id,
    hours: (shop.opening_hours ?? []) as DayHours[],
    rules: {
      slotMinutes: s.booking_slot_minutes,
      daysAhead: s.booking_days_ahead,
      maxParty: s.booking_max_party,
      depositPerPersonPence: s.booking_deposit_per_person_pence,
      refundNoticeHours: s.booking_refund_notice_hours,
    },
    tables: ((shop.dining_tables ?? []) as { id: string; number: number; is_bookable: boolean }[]).filter((t) => t.is_bookable).map((t) => ({ id: t.id, number: t.number })),
  };
}

/** Tables taken on a UK date (active bookings and unexpired holds), after letting go of expired holds. */
async function busyOn(ctx: BookingContext, date: string, exceptBookingId?: string): Promise<BusyTable[]> {
  const db = adminClient();
  await db.rpc("release_expired_booking_holds", { p_shop_id: ctx.shopId });
  const from = new Date(`${date}T00:00:00Z`).getTime() - 26 * 3_600_000;
  const to = new Date(`${date}T00:00:00Z`).getTime() + 50 * 3_600_000;
  const { data } = await db
    .from("booking_tables")
    .select("booking_id, dining_table_id, starts_at, ends_at, bookings!inner(shop_id)")
    .eq("is_active", true)
    .eq("bookings.shop_id", ctx.shopId)
    .lt("starts_at", new Date(to).toISOString())
    .gt("ends_at", new Date(from).toISOString());
  return (data ?? [])
    .filter((r) => r.booking_id !== exceptBookingId)
    .map((r) => ({ tableId: r.dining_table_id, startsAt: r.starts_at, endsAt: r.ends_at }));
}

export async function freeStartTimes(date: string, party: number, now = new Date()) {
  const ctx = await bookingContext();
  if (!isBookableDate(date, now, ctx.rules.daysAhead)) return [];
  const busy = await busyOn(ctx, date);
  return availableStarts(ctx.hours, date, now, ctx.rules, ctx.tables, busy, party);
}

export type HoldResult = { ok: true; bookingId: string; token: string; depositPence: number; tables: number[] } | { ok: false; error: string };

/** Picks tables and holds them for a party while they pay. */
export async function holdTables(input: { date: string; startIso: string; party: number; name: string; phone: string; email: string }, now = new Date()): Promise<HoldResult> {
  const ctx = await bookingContext();
  const busy = await busyOn(ctx, input.date);
  const slot = availableStarts(ctx.hours, input.date, now, ctx.rules, ctx.tables, busy, input.party).find((s) => s.iso === input.startIso);
  if (!slot) return { ok: false, error: "Sorry, that time has just been taken. Please pick another." };
  const tables = pickTables(freeTables(ctx.tables, busy, slot.iso, slot.endIso), tablesNeeded(input.party));
  if (!tables) return { ok: false, error: "Sorry, that time has just been taken. Please pick another." };
  const deposit = depositPence(input.party, ctx.rules);
  const { data, error } = await adminClient().rpc("create_booking_hold", {
    p_shop_id: ctx.shopId,
    p_starts_at: slot.iso,
    p_ends_at: slot.endIso,
    p_party: input.party,
    p_deposit_pence: deposit,
    p_table_ids: tables.map((t) => t.id),
    p_name: input.name,
    p_phone: input.phone,
    p_email: input.email,
    p_hold_minutes: HOLD_MINUTES,
  });
  if (error) return { ok: false, error: /no_overlap|exclusion/i.test(error.message) ? "Sorry, that time has just been taken. Please pick another." : "Couldn't hold your table. Please try again." };
  const row = (Array.isArray(data) ? data[0] : data) as { booking_id: string; access_token: string };
  return { ok: true, bookingId: row.booking_id, token: row.access_token, depositPence: deposit, tables: tables.map((t) => t.number) };
}

export type BookingView = {
  id: string;
  status: "pending_payment" | "confirmed" | "cancelled" | "completed" | "no_show";
  starts_at: string;
  ends_at: string;
  party_size: number;
  deposit_pence: number;
  refunded_pence: number;
  customer_name: string | null;
  customer_email: string | null;
  access_token: string;
  note: string | null;
  tables: number[];
};

const BOOKING_SELECT =
  "id, status, starts_at, ends_at, party_size, deposit_pence, refunded_pence, customer_name, customer_email, access_token, note, booking_tables(dining_tables(number))";

type BookingRow = Omit<BookingView, "tables"> & { booking_tables: { dining_tables: { number: number } | null }[] };
const toView = (r: BookingRow): BookingView => {
  const { booking_tables, ...rest } = r;
  return { ...rest, tables: booking_tables.map((t) => t.dining_tables?.number).filter((n): n is number => typeof n === "number").sort((a, b) => a - b) };
};

export async function bookingById(id: string): Promise<BookingView | null> {
  const { data } = await adminClient().from("bookings").select(BOOKING_SELECT).eq("id", id).maybeSingle();
  return data ? toView(data as unknown as BookingRow) : null;
}

export async function bookingByToken(token: string): Promise<BookingView | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  try {
    const { data } = await adminClient().from("bookings").select(BOOKING_SELECT).eq("access_token", token).maybeSingle();
    return data ? toView(data as unknown as BookingRow) : null;
  } catch {
    return null;
  }
}

async function paymentIntentFor(bookingId: string): Promise<string | null> {
  const { data } = await adminClient().from("payments").select("stripe_payment_intent_id").eq("booking_id", bookingId).eq("status", "succeeded").maybeSingle();
  return data?.stripe_payment_intent_id ?? null;
}

/** Refunds what's left of the deposit. Returns the pence refunded. */
async function refundDeposit(b: BookingView, reason: string): Promise<number> {
  const amount = b.deposit_pence - b.refunded_pence;
  if (amount <= 0) return 0;
  const pi = await paymentIntentFor(b.id);
  if (!pi) return 0;
  const refund = await stripe().refunds.create({ payment_intent: pi, amount, metadata: { booking_id: b.id, reason } }, { idempotencyKey: `booking-refund-${b.id}` });
  const { data: pay } = await adminClient().from("payments").select("id").eq("stripe_payment_intent_id", pi).single();
  if (pay) await adminClient().from("refunds").insert({ payment_id: pay.id, stripe_refund_id: refund.id, amount_pence: amount, reason });
  return amount;
}

export type ConfirmResult = { ok: true; booking: BookingView } | { ok: false; reason: "unpaid" | "not_ours" | "conflict" | "error"; message: string };

/** Turns a paid Stripe session into a confirmed booking. Safe to call more than once (thank-you page and webhook). */
export async function confirmBookingSession(sessionId: string): Promise<ConfirmResult> {
  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId);
    const bookingId = session.metadata?.kind === "booking" ? session.metadata.booking_id : undefined;
    if (!bookingId) return { ok: false, reason: "not_ours", message: "Not a booking" };
    if (session.payment_status !== "paid") return { ok: false, reason: "unpaid", message: "Payment not completed" };
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (!pi) return { ok: false, reason: "error", message: "No payment reference" };
    const { data, error } = await adminClient().rpc("confirm_booking", { p_booking_id: bookingId, p_payment_intent: pi, p_amount_pence: session.amount_total ?? 0 });
    if (error) return { ok: false, reason: "error", message: error.message };
    const booking = await bookingById(bookingId);
    if (!booking) return { ok: false, reason: "error", message: "Booking not found" };
    if (data === "conflict") {
      if (booking.refunded_pence < booking.deposit_pence) {
        const refunded = await refundDeposit(booking, "Tables taken after the hold ran out");
        await adminClient().rpc("close_booking", { p_booking_id: booking.id, p_status: "cancelled", p_refunded_pence: refunded, p_note: null });
      }
      return { ok: false, reason: "conflict", message: "Tables taken" };
    }
    return { ok: true, booking };
  } catch (e) {
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Confirmation email, at most once per booking. */
export async function sendBookingEmailOnce(bookingId: string, siteUrl: string): Promise<"sent" | "already_sent" | "no_email" | "not_configured" | "failed"> {
  if (!emailConfigured()) return "not_configured";
  const b = await bookingById(bookingId);
  if (!b || b.status !== "confirmed") return "failed";
  if (!b.customer_email) return "no_email";
  const db = adminClient();
  const { data: claimed } = await db.from("bookings").update({ confirmation_sent_at: new Date().toISOString() }).eq("id", bookingId).is("confirmation_sent_at", null).select("id");
  if (!claimed || claimed.length === 0) return "already_sent";
  const ctx = await bookingContext();
  const { subject, html, text } = buildBookingEmail(b, `${siteUrl}/booking/${b.access_token}`, ctx.rules.refundNoticeHours);
  const ok = await sendEmail({ to: b.customer_email, subject, html, text, idempotencyKey: `booking-${bookingId}` });
  if (!ok) await db.from("bookings").update({ confirmation_sent_at: null }).eq("id", bookingId);
  return ok ? "sent" : "failed";
}

export type CancelResult = { ok: true; refundedPence: number } | { ok: false; error: string };

/** Customer cancels from the Manage booking link: full refund only with enough notice. */
export async function cancelByCustomer(token: string, now = new Date()): Promise<CancelResult> {
  const b = await bookingByToken(token);
  if (!b) return { ok: false, error: "Booking not found." };
  if (b.status !== "confirmed") return { ok: false, error: "This booking is already closed." };
  if (new Date(b.starts_at).getTime() <= now.getTime()) return { ok: false, error: "This booking has already started. Please speak to a member of staff." };
  const ctx = await bookingContext();
  try {
    const refunded = refundDue(b.starts_at, now, ctx.rules.refundNoticeHours) ? await refundDeposit(b, "Cancelled by customer in time") : 0;
    await adminClient().rpc("close_booking", { p_booking_id: b.id, p_status: "cancelled", p_refunded_pence: refunded, p_note: refunded ? null : "Cancelled late by customer: deposit kept" });
    return { ok: true, refundedPence: refunded };
  } catch {
    return { ok: false, error: "Couldn't cancel right now. Please try again or call us." };
  }
}

/** Staff: cancel with full refund, or mark a no-show (deposit kept). */
export async function closeByStaff(bookingId: string, action: "cancel" | "no_show", staffName: string): Promise<CancelResult> {
  const b = await bookingById(bookingId);
  if (!b) return { ok: false, error: "Booking not found." };
  if (b.status !== "confirmed") return { ok: false, error: "This booking is already closed." };
  try {
    const refunded = action === "cancel" ? await refundDeposit(b, `Cancelled by ${staffName}`) : 0;
    await adminClient().rpc("close_booking", {
      p_booking_id: b.id,
      p_status: action === "cancel" ? "cancelled" : "no_show",
      p_refunded_pence: refunded,
      p_note: action === "cancel" ? `Cancelled by ${staffName}` : `No-show (marked by ${staffName})`,
    });
    return { ok: true, refundedPence: refunded };
  } catch {
    return { ok: false, error: "Couldn't update the booking. Please try again." };
  }
}

/** Staff: move a booking to another time (any time inside opening hours that has enough free tables). */
export async function moveByStaff(bookingId: string, date: string, startIso: string, now = new Date()): Promise<{ ok: true; when: string } | { ok: false; error: string }> {
  const b = await bookingById(bookingId);
  if (!b || b.status !== "confirmed") return { ok: false, error: "Only confirmed bookings can be moved." };
  const ctx = await bookingContext();
  const slot = startTimes(ctx.hours, date, now, ctx.rules.slotMinutes).find((s) => s.iso === startIso);
  if (!slot) return { ok: false, error: "Pick a time inside opening hours." };
  const busy = await busyOn(ctx, date, b.id);
  const tables = pickTables(freeTables(ctx.tables, busy, slot.iso, slot.endIso), tablesNeeded(b.party_size));
  if (!tables) return { ok: false, error: "Not enough free tables at that time." };
  const { error } = await adminClient().rpc("move_booking", { p_booking_id: b.id, p_starts_at: slot.iso, p_ends_at: slot.endIso, p_table_ids: tables.map((t) => t.id) });
  if (error) return { ok: false, error: "Those tables were just taken. Try another time." };
  return { ok: true, when: bookingWhen(slot.iso) };
}

/** A booking's unused deposit for an order placed now at this table (from 15 minutes before the slot to its end). */
export async function depositForTable(tableId: string, subtotalPence: number, now = new Date()): Promise<{ bookingId: string; creditPence: number } | null> {
  const soon = new Date(now.getTime() + 15 * 60_000).toISOString();
  const { data } = await adminClient()
    .from("booking_tables")
    .select("booking_id, bookings!inner(status, deposit_pence, deposit_used_order_id)")
    .eq("dining_table_id", tableId)
    .eq("is_active", true)
    .lte("starts_at", soon)
    .gt("ends_at", now.toISOString())
    .eq("bookings.status", "confirmed")
    .limit(1);
  const row = data?.[0] as unknown as { booking_id: string; bookings: { deposit_pence: number; deposit_used_order_id: string | null } } | undefined;
  if (!row) return null;
  const credit = depositCredit(row.bookings.deposit_pence, subtotalPence, !!row.bookings.deposit_used_order_id);
  return credit > 0 ? { bookingId: row.booking_id, creditPence: credit } : null;
}
