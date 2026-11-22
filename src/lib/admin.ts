import type { DayHours } from "./opening";

export const MAX_ITEM_PENCE = 10_000;
export const MAX_EXTRA_PENCE = 2_000;

/**
 * "7.50", "£7.5", "7" → 750. Returns null for anything that isn't a plain amount of pounds and pence,
 * or is outside 0 to `max` pence. Money is always whole pence.
 */
export function poundsToPence(input: string, max = MAX_ITEM_PENCE): number | null {
  const s = input.trim().replace(/^£/, "").trim();
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const [pounds, pence = ""] = s.split(".");
  const value = Number(pounds) * 100 + Number(pence.padEnd(2, "0"));
  return value <= max ? value : null;
}

/** 750 → "7.50" for an input box. */
export const penceToPounds = (pence: number) => (pence / 100).toFixed(2);

export type DayForm = { isoDay: number; open: boolean; opens: string; closes: string };

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** The week as seven rows for the form; a day with no hours is closed. */
export function hoursToForm(hours: DayHours[]): DayForm[] {
  return DAY_NAMES.map((_, i) => {
    const h = hours.find((d) => d.iso_day === i + 1);
    return { isoDay: i + 1, open: !!h, opens: h ? h.opens.slice(0, 5) : "09:30", closes: h ? h.closes.slice(0, 5) : "22:00" };
  });
}

/** Checks the form and turns it into what admin_set_hours expects. */
export function formToHours(days: DayForm[]): { ok: true; hours: { iso_day: number; opens: string; closes: string }[] } | { ok: false; error: string } {
  const hours: { iso_day: number; opens: string; closes: string }[] = [];
  for (const d of days) {
    if (!d.open) continue;
    const name = DAY_NAMES[d.isoDay - 1];
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(d.opens) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(d.closes)) return { ok: false, error: `${name}: times must look like 09:30` };
    if (d.closes <= d.opens) return { ok: false, error: `${name}: closing time must be after opening time` };
    hours.push({ iso_day: d.isoDay, opens: d.opens, closes: d.closes });
  }
  return { ok: true, hours };
}

export type TodayOrder = { number: number; status: string; type: string; total_pence: number; created_at: string };

/** Orders, money taken and average for the day. Cancelled orders don't count. */
export function todaySummary(orders: TodayOrder[]): { count: number; takenPence: number; averagePence: number } {
  const counted = orders.filter((o) => o.status !== "cancelled");
  const takenPence = counted.reduce((sum, o) => sum + o.total_pence, 0);
  return { count: counted.length, takenPence, averagePence: counted.length ? Math.round(takenPence / counted.length) : 0 };
}

/** Fit a photo inside `max` pixels on its longest side, keeping its shape. */
export function fitWithin(width: number, height: number, max = 1200): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}
