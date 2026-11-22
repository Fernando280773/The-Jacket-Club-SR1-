"use client";

import { useBasket } from "./BasketProvider";

/** Invisible button covering a whole item card, so tapping anywhere on it opens the item. */
export function OpenItemButton({ code, name }: { code: string; name: string }) {
  const basket = useBasket();
  if (!basket) return null;
  return (
    <button
      type="button"
      aria-label={`Choose ${name}`}
      onClick={() => basket.openItem(code)}
      className="absolute inset-0 z-[1] rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-club-green"
    />
  );
}
