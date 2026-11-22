"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { StartTime } from "@/lib/bookings";
import { formatPence } from "@/lib/money";
import { bookingTimes, startBooking } from "./actions";

const inputClass = "w-full rounded-xl border border-club-line bg-white px-4 py-3 text-base outline-none focus:border-club-green";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
    </div>
  );
}

export function BookingForm({ dates, maxParty, depositPerPersonPence }: { dates: { date: string; label: string }[]; maxParty: number; depositPerPersonPence: number }) {
  const [date, setDate] = useState(dates[0]?.date ?? "");
  const [party, setParty] = useState(2);
  const [times, setTimes] = useState<StartTime[] | null>(null);
  const [startIso, setStartIso] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stopped = false;
    setTimes(null);
    setStartIso("");
    bookingTimes(date, party).then((r) => {
      if (stopped) return;
      setTimes(r.ok ? r.times : []);
      if (!r.ok) setMessage(r.error);
    });
    return () => {
      stopped = true;
    };
  }, [date, party]);

  const deposit = party * depositPerPersonPence;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!startIso) {
      setMessage("Please pick a time.");
      return;
    }
    setBusy(true);
    setMessage(null);
    const r = await startBooking({ date, startIso, party, name, phone, email }).catch(() => ({ ok: false as const, error: "Something went wrong. Please try again." }));
    if (r.ok) {
      window.location.href = r.url;
      return;
    }
    setErrors("fieldErrors" in r && r.fieldErrors ? r.fieldErrors : {});
    setMessage(r.error);
    setBusy(false);
    if (/taken/.test(r.error)) bookingTimes(date, party).then((t) => t.ok && setTimes(t.times));
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <section aria-label="Date" className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Date</h2>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {dates.map((d) => (
            <button
              key={d.date}
              type="button"
              data-testid="booking-date"
              aria-pressed={date === d.date}
              onClick={() => setDate(d.date)}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold ${date === d.date ? "bg-club-green text-club-paper" : "bg-club-cream"}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </section>

      <Field id="party" label="How many people?">
        <select id="party" data-testid="party-size" value={party} onChange={(e) => setParty(Number(e.target.value))} className={inputClass}>
          {Array.from({ length: maxParty }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "person" : "people"}
            </option>
          ))}
        </select>
      </Field>

      <section aria-label="Time" className="flex flex-col gap-2">
        <h2 className="text-sm font-bold">Time</h2>
        {times === null && <p className="text-club-muted">Checking free tables…</p>}
        {times && times.length === 0 && (
          <p data-testid="no-times" className="rounded-xl bg-club-cream px-4 py-3 font-bold">
            No tables free for {party} on this day. Try another day or a smaller party.
          </p>
        )}
        {times && times.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {times.map((t) => (
              <button
                key={t.iso}
                type="button"
                data-testid="booking-time"
                aria-pressed={startIso === t.iso}
                onClick={() => setStartIso(t.iso)}
                className={`rounded-xl py-2 text-sm font-bold ${startIso === t.iso ? "bg-club-green text-club-paper" : "border border-club-line bg-white"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Your details" className="flex flex-col gap-3">
        <Field id="name" label="Name" error={errors.name}>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field id="phone" label="Mobile number" error={errors.phone}>
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
        </Field>
        <Field id="email" label="Email for your confirmation" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
      </section>

      {message && (
        <p role="alert" data-testid="booking-message" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {message}
        </p>
      )}

      <button type="submit" data-testid="pay-deposit" disabled={busy || !startIso} className="rounded-2xl bg-club-green px-5 py-4 font-bold text-club-paper disabled:bg-club-green/40">
        {busy ? "Opening secure payment…" : `Pay ${formatPence(deposit)} deposit`}
      </button>
      <p className="text-center text-xs text-club-muted">Secure payment by Stripe. The deposit comes off your bill.</p>
    </form>
  );
}
