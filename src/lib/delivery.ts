import type { DayHours } from "./opening";
import { londonTimeToday, type Slot } from "./slots";
import { londonClock } from "./opening";

export type DeliveryRules = { firstMilePence: number; perExtraMilePence: number; maxMiles: number; minOrderPence: number };

/** 12–14 Park Lane, Sunderland SR1 3NX (from Mapbox). */
export const SHOP_LOCATION = { latitude: 54.90345, longitude: -1.38565 };

export const METRES_PER_MILE = 1609.344;
/** Kitchen plus driving time before the first delivery slot. */
export const DELIVERY_LEAD_MINUTES = 45;

export const metresToMiles = (m: number) => Math.round((m / METRES_PER_MILE) * 100) / 100;

/**
 * Fee for a road distance: the first mile, plus each extra mile started (rounded up).
 * 0.5 mi £1.99 · 1 mi £1.99 · 1.1 mi £2.79 · 2.5 mi £3.59 · 4 mi £4.39. Null when too far.
 */
export function deliveryFeePence(miles: number, rules: DeliveryRules): number | null {
  if (!Number.isFinite(miles) || miles < 0 || miles > rules.maxMiles) return null;
  const extra = Math.max(0, Math.ceil(Math.round((miles - 1) * 100) / 100));
  return rules.firstMilePence + extra * rules.perExtraMilePence;
}

/** How much more food is needed before delivery can be ordered (the fee doesn't count). */
export const shortOfDeliveryMinimum = (subtotalPence: number, rules: Pick<DeliveryRules, "minOrderPence">) => Math.max(0, rules.minOrderPence - subtotalPence);

/** Delivery times left today, every 15 minutes, from 45 minutes ahead up to closing time. */
export function deliverySlots(hours: DayHours[], now: Date, lead = DELIVERY_LEAD_MINUTES, step = 15): Slot[] {
  const { isoDay, minutes } = londonClock(now);
  const today = hours.find((h) => h.iso_day === isoDay);
  if (!today) return [];
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const opens = toMin(today.opens);
  const last = toMin(today.closes);
  const pad = (n: number) => String(n).padStart(2, "0");
  const slots: Slot[] = [];
  for (let t = Math.max(opens + lead, Math.ceil((minutes + lead) / step) * step); t <= last; t += step) {
    slots.push({ iso: londonTimeToday(now, t).toISOString(), label: `${pad(Math.floor(t / 60))}:${pad(t % 60)}` });
  }
  return slots;
}

/** Google Maps driving directions to an address, for the driver's Navigate button. */
export function navigateUrl(d: { latitude: number | null; longitude: number | null; address_text: string; postcode: string }): string {
  const dest = d.latitude != null && d.longitude != null ? `${d.latitude},${d.longitude}` : `${d.address_text}, ${d.postcode}`;
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(dest)}`;
}

/** UK postcode inside an address line, e.g. "SR1 3NX". */
export function postcodeOf(text: string): string {
  const m = text.toUpperCase().match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/);
  return m ? `${m[1]} ${m[2]}` : "";
}
