"use server";

import { quoteForAddress, type DeliveryQuote } from "@/lib/server/delivery";
import { mapboxConfigured, searchAddresses, type AddressMatch } from "@/lib/server/mapbox";

/** Address suggestions while the customer types (UK only, nearest the shop first). */
export async function searchDeliveryAddress(query: string): Promise<AddressMatch[]> {
  if (!mapboxConfigured()) return [];
  try {
    return await searchAddresses(String(query ?? ""));
  } catch {
    return [];
  }
}

/** Road distance and fee for a chosen address. */
export async function quoteDelivery(label: string): Promise<DeliveryQuote> {
  if (!mapboxConfigured()) return { ok: false, reason: "unavailable", error: "Delivery isn't switched on yet. Please choose Collect." };
  return quoteForAddress(String(label ?? "").slice(0, 200));
}
