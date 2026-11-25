"use client";

import { milesText } from "@/lib/delivery";
import { useEffect, useRef, useState } from "react";
import { formatPence } from "@/lib/money";
import type { DeliveryQuote } from "@/lib/server/delivery";
import type { AddressMatch } from "@/lib/server/mapbox";
import { quoteDelivery, searchDeliveryAddress } from "@/app/basket/delivery-actions";
import { useBasket } from "./BasketProvider";

/** Address search and delivery fee for the basket and checkout. Saves only the chosen address text on the phone. */
export function DeliveryAddress({ onQuote, savedAddresses = [] }: { onQuote?: (q: DeliveryQuote | null) => void; savedAddresses?: string[] }) {
  const basket = useBasket();
  const saved = basket?.delivery?.label ?? "";
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<AddressMatch[]>([]);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [checking, setChecking] = useState(false);
  const [editing, setEditing] = useState(!saved);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-check the saved address each time (distance and fee always come from the server).
  useEffect(() => {
    if (!saved) {
      setQuote(null);
      onQuote?.(null);
      return;
    }
    setChecking(true);
    quoteDelivery(saved).then((q) => {
      setQuote(q);
      onQuote?.(q);
      setChecking(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved]);

  const type = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 3) {
      setMatches([]);
      return;
    }
    timer.current = setTimeout(() => searchDeliveryAddress(value).then(setMatches), 300);
  };

  const choose = (m: AddressMatch) => {
    basket?.setDelivery({ label: m.label });
    setMatches([]);
    setQuery("");
    setEditing(false);
  };

  return (
    <section aria-label="Delivery address" data-testid="delivery-address" className="flex flex-col gap-2 rounded-2xl bg-club-cream p-4">
      <h2 className="font-bold">Delivery address</h2>
      {saved && !editing ? (
        <div className="flex items-start justify-between gap-3">
          <p data-testid="delivery-label" className="text-sm">
            {saved}
          </p>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 text-sm font-bold text-club-green underline">
            Change
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col gap-2">
          {savedAddresses.length > 0 && (
            <ul aria-label="Your saved addresses" className="flex flex-col gap-2">
              {savedAddresses.map((label) => (
                <li key={label}>
                  <button type="button" data-testid="saved-address-option" onClick={() => choose({ label } as AddressMatch)} className="w-full rounded-xl bg-white px-4 py-3 text-left text-sm font-bold">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            type="text"
            data-testid="address-search"
            autoComplete="street-address"
            value={query}
            onChange={(e) => type(e.target.value)}
            placeholder="Start typing your street or postcode"
            aria-label="Search for your address"
            className="w-full rounded-xl border border-club-line bg-white px-4 py-3 text-base outline-none focus:border-club-green"
          />
          {matches.length > 0 && (
            <ul role="listbox" className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-club-line bg-white shadow-lg">
              {matches.map((m) => (
                <li key={m.label}>
                  <button type="button" role="option" aria-selected="false" data-testid="address-option" onClick={() => choose(m)} className="w-full px-4 py-3 text-left text-sm hover:bg-club-cream">
                    {m.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {checking && <p className="text-sm text-club-muted">Checking distance…</p>}
      {!checking && quote?.ok && saved && (
        <p data-testid="delivery-quote" className="text-sm font-bold text-club-green">
          {milesText(quote.miles)} miles by road · delivery {formatPence(quote.feePence)}
        </p>
      )}
      {!checking && quote && !quote.ok && saved && (
        <p role="alert" data-testid="delivery-refused" className="text-sm font-bold text-red-700">
          {quote.error}
        </p>
      )}
    </section>
  );
}
