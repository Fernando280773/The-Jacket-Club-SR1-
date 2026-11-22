"use client";

import Link from "next/link";
import { formatPence } from "@/lib/money";
import { useBasket, useBasketSummary } from "./BasketProvider";

/** Sticks to the bottom of the menu once something is in the basket. */
export function BasketBar() {
  const basket = useBasket();
  const { itemCount, subtotalPence } = useBasketSummary();
  if (!basket?.ready || itemCount === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <Link
        href="/basket"
        data-testid="basket-bar"
        className="mx-auto flex max-w-xl items-center justify-between rounded-2xl bg-club-green px-5 py-4 font-bold text-club-paper shadow-lg"
      >
        <span>View basket</span>
        <span>
          {itemCount} {itemCount === 1 ? "item" : "items"} · {formatPence(subtotalPence)}
        </span>
      </Link>
    </div>
  );
}
