"use client";

import { useState } from "react";

const TYPES = [
  { key: "collect", label: "Collect" },
  { key: "table", label: "Table" },
  { key: "book", label: "Book" },
  { key: "delivery", label: "Delivery" },
] as const;

/** Visual only in Step 5. Each choice starts working in a later step (basket, booking, delivery). */
export function OrderTypes() {
  const [chosen, setChosen] = useState<string>("collect");
  return (
    <div role="radiogroup" aria-label="How would you like your order?" className="grid grid-cols-4 gap-1 rounded-2xl bg-club-cream p-1">
      {TYPES.map((t) => (
        <button
          key={t.key}
          type="button"
          role="radio"
          aria-checked={chosen === t.key}
          onClick={() => setChosen(t.key)}
          className={`rounded-xl py-2 text-sm font-bold transition-colors ${
            chosen === t.key ? "bg-club-green text-club-paper" : "text-club-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
