"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/components/StaffGate";
import { tablesText } from "@/lib/booking-email";
import { bookingDates, type StartTime } from "@/lib/bookings";
import { ukMidnight } from "@/lib/kitchen";
import { formatPence } from "@/lib/money";
import { staffClient } from "@/lib/staff-client";

export type StaffBooking = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  deposit_pence: number;
  refunded_pence: number;
  customer_name: string | null;
  customer_phone: string | null;
  note: string | null;
  deposit_used_order_id: string | null;
  booking_tables: { is_active: boolean; dining_tables: { number: number } | null }[];
};

export const STAFF_BOOKING_SELECT =
  "id, status, starts_at, ends_at, party_size, deposit_pence, refunded_pence, customer_name, customer_phone, note, deposit_used_order_id, booking_tables(is_active, dining_tables(number))";

const STATUS: Record<string, string> = { confirmed: "Booked", pending_payment: "Paying…", cancelled: "Cancelled", no_show: "No-show", completed: "Finished" };
const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const ukDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
export const tableNumbers = (b: StaffBooking) => b.booking_tables.map((t) => t.dining_tables?.number).filter((n): n is number => typeof n === "number");

async function staffFetch(url: string, init?: RequestInit) {
  const { data } = await staffClient().auth.getSession();
  return fetch(url, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${data.session?.access_token ?? ""}`, "Content-Type": "application/json" } });
}

/** Today's and the coming week's bookings, with Cancel (refund), No-show and Move. */
export function BookingsTab({ staff }: { staff: Staff }) {
  const [list, setList] = useState<StaffBooking[] | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState<StaffBooking | null>(null);

  const load = useCallback(async () => {
    const from = ukMidnight(new Date());
    const to = new Date(new Date(from).getTime() + 9 * 86_400_000).toISOString();
    const { data, error } = await staffClient()
      .from("bookings")
      .select(STAFF_BOOKING_SELECT)
      .eq("shop_id", staff.shopId)
      .gte("starts_at", from)
      .lt("starts_at", to)
      .in("status", ["confirmed", "pending_payment", "no_show", "cancelled", "completed"])
      .order("starts_at");
    if (error) setNotice("Couldn't load bookings. Check the Wi-Fi.");
    else setList((data ?? []) as unknown as StaffBooking[]);
  }, [staff.shopId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (b: StaffBooking, action: "cancel" | "no_show") => {
    const who = b.customer_name ?? "this booking";
    const question = action === "cancel" ? `Cancel ${who} and refund ${formatPence(b.deposit_pence - b.refunded_pence)}?` : `Mark ${who} as a no-show? The deposit is kept.`;
    if (!window.confirm(question)) return;
    setBusy(b.id);
    const r = await staffFetch("/api/staff/bookings", { method: "POST", body: JSON.stringify({ action, bookingId: b.id }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    setNotice(r.ok ? (action === "cancel" ? `Cancelled. ${formatPence(r.refundedPence)} refunded to ${who}.` : `${who} marked as a no-show.`) : r.error);
    setBusy(null);
    load();
  };

  if (!list) return <p>{notice || "Loading…"}</p>;
  const days = new Map<string, StaffBooking[]>();
  for (const b of list) days.set(ukDay(b.starts_at), [...(days.get(ukDay(b.starts_at)) ?? []), b]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-club-muted">Tables 1–10 can be booked; 11–15 are always for walk-ins.</p>
      {notice && (
        <p role="status" data-testid="bookings-notice" className="rounded-xl bg-club-cream px-3 py-2 font-bold">
          {notice}
        </p>
      )}
      {list.length === 0 && <p className="text-club-muted">No bookings this week yet.</p>}
      {[...days.entries()].map(([day, items]) => (
        <section key={day} aria-label={day}>
          <h2 className="mb-1 font-display text-lg text-club-green">{day}</h2>
          <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
            {items.map((b) => {
              const closed = b.status !== "confirmed";
              return (
                <li key={b.id} data-testid="staff-booking" className={`flex flex-col gap-2 px-3 py-3 ${closed ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-lg font-bold">
                      {ukTime(b.starts_at)}–{ukTime(b.ends_at)} · {b.customer_name ?? "—"}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${closed ? "bg-club-cream" : "bg-club-mint text-club-green"}`}>{STATUS[b.status] ?? b.status}</span>
                  </div>
                  <p className="text-sm">
                    {b.party_size} {b.party_size === 1 ? "person" : "people"} · {tablesText(tableNumbers(b))} · deposit {formatPence(b.deposit_pence)}
                    {b.deposit_used_order_id ? " (used)" : ""}
                    {b.refunded_pence > 0 ? ` · refunded ${formatPence(b.refunded_pence)}` : ""}
                    {b.customer_phone ? ` · ${b.customer_phone}` : ""}
                  </p>
                  {b.note && <p className="text-xs text-club-muted">{b.note}</p>}
                  {b.status === "confirmed" && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={busy === b.id} onClick={() => setMoving(b)} className="rounded-xl border border-club-line px-3 py-2 text-sm font-bold">
                        Move
                      </button>
                      <button type="button" data-testid="booking-no-show" disabled={busy === b.id} onClick={() => act(b, "no_show")} className="rounded-xl border border-club-line px-3 py-2 text-sm font-bold">
                        No-show
                      </button>
                      <button type="button" data-testid="booking-cancel" disabled={busy === b.id} onClick={() => act(b, "cancel")} className="rounded-xl border border-red-700 px-3 py-2 text-sm font-bold text-red-700">
                        Cancel &amp; refund
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {moving && (
        <MoveBooking
          booking={moving}
          onClose={() => setMoving(null)}
          onMoved={(msg) => {
            setMoving(null);
            setNotice(msg);
            load();
          }}
        />
      )}
    </div>
  );
}

function MoveBooking({ booking, onClose, onMoved }: { booking: StaffBooking; onClose: () => void; onMoved: (msg: string) => void }) {
  const dates = bookingDates(new Date(), 7);
  const [date, setDate] = useState(dates[0].date);
  const [times, setTimes] = useState<StartTime[]>([]);
  const [start, setStart] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStart("");
    staffFetch(`/api/staff/bookings?date=${date}`)
      .then((r) => r.json())
      .then((r) => setTimes(r.ok ? r.times : []))
      .catch(() => setTimes([]));
  }, [date]);

  const move = async () => {
    setBusy(true);
    setError("");
    const r = await staffFetch("/api/staff/bookings", { method: "POST", body: JSON.stringify({ action: "move", bookingId: booking.id, date, startIso: start }) })
      .then((x) => x.json())
      .catch(() => ({ ok: false, error: "Couldn't reach the server." }));
    setBusy(false);
    if (r.ok) onMoved(`${booking.customer_name ?? "Booking"} moved to ${r.when}.`);
    else setError(r.error);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <div aria-hidden="true" className="absolute inset-0 bg-club-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Move booking" className="relative flex w-full max-w-md flex-col gap-3 rounded-t-3xl bg-club-paper p-5 sm:rounded-3xl">
        <h2 className="font-display text-xl text-club-green">Move {booking.customer_name ?? "booking"}</h2>
        <label className="flex flex-col gap-1 font-bold">
          Date
          <select value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-2 font-normal">
            {dates.map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 font-bold">
          Time
          <select value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl border border-club-line bg-white px-3 py-2 font-normal">
            <option value="">Choose…</option>
            {times.map((t) => (
              <option key={t.iso} value={t.iso}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="font-bold text-red-700">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="button" disabled={!start || busy} onClick={move} className="flex-1 rounded-2xl bg-club-green px-4 py-3 font-bold text-club-paper disabled:opacity-50">
            {busy ? "Moving…" : "Move booking"}
          </button>
          <button type="button" onClick={onClose} className="rounded-2xl border border-club-line px-4 py-3 font-bold">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
