"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatPence } from "@/lib/money";
import type { PricedBasket } from "@/lib/pricing";
import { MAX_QUANTITY } from "@/lib/pricing";
import { ORDER_TYPES, useBasket } from "@/components/BasketProvider";
import { OrderTypes } from "@/components/OrderTypes";
import { priceBasketOnServer } from "./actions";

const NOTES: Record<string, string> = {
  collect: "Collect from 12–14 Park Lane. You'll choose a time at checkout.",
  table: "Eating in? Scan the QR code on your table and we'll bring your order to you.",
  book: "Booking a table comes in a later step. Choose Collect, Table or Delivery to order food.",
  delivery: "Our own drivers deliver up to 4 miles. The delivery fee is added at checkout.",
};

export function BasketView({ canOrder, paused = false, pausedMessage = null }: { canOrder: boolean; paused?: boolean; pausedMessage?: string | null }) {
  const basket = useBasket();
  const [priced, setPriced] = useState<PricedBasket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = basket?.lines;
  useEffect(() => {
    if (!basket?.ready || !lines) return;
    let cancelled = false;
    priceBasketOnServer(lines)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setPriced(r.basket);
          setError(null);
        } else setError(r.error);
      })
      .catch(() => !cancelled && setError("Could not check prices. Please try again."));
    return () => {
      cancelled = true;
    };
  }, [basket?.ready, lines]);

  if (!basket?.ready) return <p className="py-8 text-center text-club-muted">Loading your basket…</p>;

  if (basket.lines.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <p data-testid="basket-empty" className="text-lg font-bold">
          Your basket is empty
        </p>
        <Link href="/" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
          Browse the menu
        </Link>
      </div>
    );
  }

  const subtotal = priced?.subtotalPence ?? 0;
  const shortOfMinimum = basket.orderType === "delivery" && priced ? Math.max(0, basket.deliveryMinPence - subtotal) : 0;
  const typeLabel = ORDER_TYPES.find((t) => t.key === basket.orderType)?.label;

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Order type" className="flex flex-col gap-2">
        <OrderTypes />
        <p data-testid="order-type-note" className="text-sm text-club-muted">
          <span className="font-bold text-club-ink">{typeLabel}:</span>{" "}
          {basket.orderType === "table" && basket.table ? `Table ${basket.table.number}. We'll bring your order to you.` : NOTES[basket.orderType]}
        </p>
      </section>

      <ul aria-label="Basket" className="flex flex-col">
        {basket.lines.map((line) => {
          const p = priced?.lines.find((l) => l.id === line.id);
          const name = p?.name ?? basket.pricing.items[line.itemCode]?.name ?? "Item";
          return (
            <li key={line.id} data-testid="basket-line" className="flex flex-col gap-2 border-b border-club-line py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">{name}</p>
                  {p?.details && <p className="text-sm text-club-muted">{p.details}</p>}
                  {p && p.errors.length > 0 && (
                    <p role="alert" className="text-sm font-bold text-red-700">
                      {p.errors[0]}. Please remove it.
                    </p>
                  )}
                </div>
                <span data-testid="line-total" className="font-bold text-club-green">
                  {p ? formatPence(p.lineTotalPence) : "…"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-label={`One less ${name}`} disabled={line.quantity <= 1} onClick={() => basket.setQuantity(line.id, line.quantity - 1)} className="h-8 w-8 rounded-full border border-club-line font-bold disabled:opacity-30">
                  −
                </button>
                <span data-testid="line-quantity" className="w-5 text-center font-bold">
                  {line.quantity}
                </span>
                <button type="button" aria-label={`One more ${name}`} disabled={line.quantity >= MAX_QUANTITY} onClick={() => basket.setQuantity(line.id, line.quantity + 1)} className="h-8 w-8 rounded-full border border-club-line font-bold disabled:opacity-30">
                  +
                </button>
                <button type="button" onClick={() => basket.removeLine(line.id)} className="ml-auto text-sm font-bold text-club-muted underline">
                  Remove
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between text-lg font-bold">
        <span>Subtotal</span>
        <span data-testid="basket-subtotal">{priced ? formatPence(subtotal) : "…"}</span>
      </div>

      {shortOfMinimum > 0 && (
        <p data-testid="delivery-minimum" className="rounded-xl bg-club-cream px-4 py-3 text-sm font-bold">
          Add {formatPence(shortOfMinimum)} more for delivery (minimum order {formatPence(basket.deliveryMinPence)}).
        </p>
      )}

      {!canOrder ? (
        <button type="button" disabled data-testid="ordering-closed" className="rounded-2xl bg-club-green/40 px-5 py-4 font-bold text-club-paper">
          {paused ? (pausedMessage ? `Not taking orders right now · ${pausedMessage}` : "Not taking orders right now") : "Ordering opens 10 December"}
        </button>
      ) : basket.orderType === "delivery" || basket.orderType === "book" ? (
        <button type="button" disabled className="rounded-2xl bg-club-green/40 px-5 py-4 font-bold text-club-paper">
          {basket.orderType === "delivery" ? "Delivery coming soon" : "Table booking coming soon"}
        </button>
      ) : (
        <Link
          href="/checkout"
          data-testid="go-to-checkout"
          aria-disabled={!priced?.isValid}
          className={`rounded-2xl px-5 py-4 text-center font-bold text-club-paper ${priced?.isValid ? "bg-club-green" : "pointer-events-none bg-club-green/40"}`}
        >
          Go to checkout{priced ? ` · ${formatPence(subtotal)}` : ""}
        </Link>
      )}
      <Link href="/" className="text-center font-bold text-club-green underline">
        Add more items
      </Link>
    </div>
  );
}
