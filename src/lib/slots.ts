import { londonClock, type DayHours } from "./opening";

export type Slot = { iso: string; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** The UTC instant of a UK wall-clock time on the same UK date as `now`. Handles GMT and BST. */
export function londonTimeToday(now: Date, minutes: number): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now).split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const offsetName = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value; // "GMT" or "GMT+1"
  const offsetHours = Number(offsetName?.replace("GMT", "") || 0);
  return new Date(guess.getTime() - offsetHours * 3_600_000);
}

/**
 * Collection times left today, every `step` minutes. The first is at least `lead` minutes away
 * (kitchen time); the last is `lead` minutes before closing. Empty when collection is closed for today.
 */
export function pickupSlots(hours: DayHours[], now: Date, lead = 15, step = 15): Slot[] {
  const { isoDay, minutes } = londonClock(now);
  const today = hours.find((h) => h.iso_day === isoDay);
  if (!today) return [];
  const opens = toMinutes(today.opens);
  const last = toMinutes(today.closes) - lead;
  let t = Math.max(opens, Math.ceil((minutes + lead) / step) * step);
  const slots: Slot[] = [];
  for (; t <= last; t += step) {
    slots.push({ iso: londonTimeToday(now, t).toISOString(), label: `${pad(Math.floor(t / 60))}:${pad(t % 60)}` });
  }
  return slots;
}
