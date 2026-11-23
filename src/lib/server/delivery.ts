import { deliveryFeePence, metresToMiles, milesText, type DeliveryRules } from "../delivery";
import { publicClient, SHOP_SLUG } from "../supabase";
import { roadMetresFromShop, searchAddresses, type AddressMatch } from "./mapbox";

export async function deliveryRules(): Promise<DeliveryRules> {
  const { data, error } = await publicClient({ fresh: true })
    .from("shops")
    .select("shop_settings(delivery_first_mile_pence, delivery_per_extra_mile_pence, delivery_max_miles, delivery_min_order_pence)")
    .eq("slug", SHOP_SLUG)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Shop not found");
  const s = (Array.isArray(data.shop_settings) ? data.shop_settings[0] : data.shop_settings) as {
    delivery_first_mile_pence: number;
    delivery_per_extra_mile_pence: number;
    delivery_max_miles: number;
    delivery_min_order_pence: number;
  };
  return { firstMilePence: s.delivery_first_mile_pence, perExtraMilePence: s.delivery_per_extra_mile_pence, maxMiles: Number(s.delivery_max_miles), minOrderPence: s.delivery_min_order_pence };
}

export type DeliveryQuote =
  | { ok: true; address: AddressMatch; miles: number; feePence: number }
  | { ok: false; reason: "too_far" | "not_found" | "unavailable"; miles?: number; error: string };

/**
 * Works out distance and fee from the address text alone: the address is looked up again here,
 * so nothing the phone sends (coordinates, fee) is trusted.
 */
export async function quoteForAddress(label: string): Promise<DeliveryQuote> {
  try {
    const [match] = await searchAddresses(label, 1);
    if (!match) return { ok: false, reason: "not_found", error: "We couldn't find that address. Please pick one from the list." };
    const rules = await deliveryRules();
    const miles = metresToMiles(await roadMetresFromShop(match));
    const fee = deliveryFeePence(miles, rules);
    if (fee === null) return { ok: false, reason: "too_far", miles, error: `Sorry, that's ${milesText(miles)} miles away. We deliver up to ${rules.maxMiles} miles from Park Lane.` };
    return { ok: true, address: match, miles, feePence: fee };
  } catch {
    return { ok: false, reason: "unavailable", error: "Delivery can't be checked right now. Please try again, or choose Collect." };
  }
}
