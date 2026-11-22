"use client";

import { ORDER_TYPES, useBasket } from "./BasketProvider";

/** How the customer wants their order. Remembered with the basket; checkout uses it from Step 7. */
export function OrderTypes() {
  const basket = useBasket();
  const chosen = basket?.orderType ?? "collect";
  return (
    <div role="radiogroup" aria-label="How would you like your order?" className="grid grid-cols-4 gap-1 rounded-2xl bg-club-cream p-1">
      {ORDER_TYPES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={chosen === t.key}
          onClick={() => basket?.setOrderType(t.key)}
          className={`rounded-xl py-2 text-sm font-bold transition-colors ${chosen === t.key ? "bg-club-green text-club-paper" : "text-club-ink"}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
