"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPence } from "@/lib/money";
import type { PricedBasket } from "@/lib/pricing";
import type { Slot } from "@/lib/slots";
import { useBasket } from "@/components/BasketProvider";
import { priceBasketOnServer } from "../basket/actions";
import { startCheckout } from "./actions";

const inputClass = "w-full rounded-xl border border-club-line bg-white px-4 py-3 text-base outline-none focus:border-club-green";

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-bold">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm font-bold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function CheckoutForm({ slots }: { slots: Slot[] }) {
  const basket = useBasket();
  const [priced, setPriced] = useState<PricedBasket | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lines = basket?.lines;
  useEffect(() => {
    if (!basket?.ready || !lines) return;
    priceBasketOnServer(lines).then((r) => r.ok && setPriced(r.basket));
  }, [basket?.ready, lines]);

  useEffect(() => {
    if (!pickupAt && slots[0]) setPickupAt(slots[0].iso);
  }, [slots, pickupAt]);

  if (!basket?.ready) return <p className="py-8 text-center text-club-muted">Loading…</p>;
  if (basket.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p className="text-lg font-bold">Your basket is empty</p>
        <Link href="/" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
          Browse the menu
        </Link>
      </div>
    );
  }

  const type = basket.orderType;
  const unsupported = type === "delivery" || type === "book";
  const needsTable = type === "table" && !basket.table;
  const noSlots = type === "collect" && slots.length === 0;

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const r = await startCheckout({ lines: basket.lines, orderType: type, tableToken: basket.table?.token, pickupAt, name, phone, email }).catch(() => ({
      ok: false as const,
      error: "Something went wrong. Please try again.",
    }));
    if (r.ok) {
      window.location.href = r.url;
      return;
    }
    setErrors("fieldErrors" in r && r.fieldErrors ? r.fieldErrors : {});
    setMessage(r.error);
    setBusy(false);
  };

  return (
    <form onSubmit={pay} noValidate className="flex flex-col gap-5">
      <section aria-label="Your order" className="rounded-2xl bg-club-cream p-4">
        <ul className="flex flex-col gap-2 text-sm">
          {(priced?.lines ?? []).map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>
                <span className="font-bold">{l.quantity} × {l.name}</span>
                {l.details && <span className="block text-club-muted">{l.details}</span>}
              </span>
              <span className="font-bold">{formatPence(l.lineTotalPence)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t border-club-line pt-3 font-bold">
          <span>Total</span>
          <span data-testid="checkout-total">{priced ? formatPence(priced.subtotalPence) : "…"}</span>
        </div>
        <Link href="/basket" className="mt-2 inline-block text-sm font-bold text-club-green underline">
          Edit basket
        </Link>
      </section>

      <section aria-label="Collection or table" className="flex flex-col gap-2">
        {type === "collect" && !noSlots && (
          <Field id="pickupAt" label="Collection time (today)" error={errors.pickupAt}>
            <select id="pickupAt" value={pickupAt} onChange={(e) => setPickupAt(e.target.value)} className={inputClass}>
              {slots.map((s) => (
                <option key={s.iso} value={s.iso}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        {noSlots && <p data-testid="collection-closed" className="rounded-xl bg-club-cream px-4 py-3 font-bold">Collection is closed for today. Please come back tomorrow.</p>}
        {type === "table" && basket.table && <p data-testid="table-number" className="rounded-xl bg-club-mint px-4 py-3 font-bold text-club-green">Table {basket.table.number}: we&apos;ll bring your order to you.</p>}
        {needsTable && <p className="rounded-xl bg-club-cream px-4 py-3 font-bold">Please scan the QR code on your table to order to it, or choose Collect.</p>}
        {unsupported && <p className="rounded-xl bg-club-cream px-4 py-3 font-bold">{type === "delivery" ? "Delivery" : "Table booking"} is coming soon. Please choose Collect or Table in your basket.</p>}
      </section>

      <section aria-label="Your details" className="flex flex-col gap-3">
        <Field id="name" label="Name" error={errors.name}>
          <input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-invalid={!!errors.name} />
        </Field>
        <Field id="phone" label="Mobile number" error={errors.phone}>
          <input id="phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} aria-invalid={!!errors.phone} />
        </Field>
        <Field id="email" label="Email for your receipt (optional)" error={errors.email}>
          <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} aria-invalid={!!errors.email} />
        </Field>
      </section>

      {message && (
        <p role="alert" data-testid="checkout-message" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {message}
        </p>
      )}

      <button
        type="submit"
        data-testid="pay-button"
        disabled={busy || unsupported || needsTable || noSlots || !priced?.isValid}
        className="rounded-2xl bg-club-green px-5 py-4 font-bold text-club-paper disabled:bg-club-green/40"
      >
        {busy ? "Opening secure payment…" : `Pay ${priced ? formatPence(priced.subtotalPence) : ""}`}
      </button>
      <p className="text-center text-xs text-club-muted">Secure payment by Stripe: card, Apple Pay or Google Pay.</p>
    </form>
  );
}
