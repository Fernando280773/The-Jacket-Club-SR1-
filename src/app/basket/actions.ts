"use server";

import { getMenu } from "@/lib/menu";
import { parseLines, priceBasket, pricingMenuFrom, type PricedBasket } from "@/lib/pricing";

/** The basket priced by the server from the live menu. Only item codes, option ids and quantities are trusted. */
export async function priceBasketOnServer(input: unknown): Promise<{ ok: true; basket: PricedBasket } | { ok: false; error: string }> {
  const result = await getMenu();
  if (!result.ok) return { ok: false, error: "The menu could not be loaded. Please try again." };
  return { ok: true, basket: priceBasket(pricingMenuFrom(result.menu), parseLines(input)) };
}
