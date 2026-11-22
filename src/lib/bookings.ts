import type { DayHours } from "./opening";

/** Booking rules from shop_settings. */
export type BookingRules = {
  slotMinutes: number;
  daysAhead: number;
  maxParty: number;
  depositPerPersonPence: number;
  refundNoticeHours: number;
};

export const SEATS_PER_TABLE = 2;
/** Start times are offered every 30 minutes, and today's begin at least 30 minutes from now. */
export const START_STEP_MINUTES = 30;
export const LEAD_MINUTES = 30;
/** How long tables are held while the customer is on Stripe's payment page. */
export const HOLD_MINUTES = 35;

export type BookableTable = { id: string; number: number };
export type BusyTable = { tableId: string; startsAt: string; endsAt: string };
export type StartTime = { iso: string; endIso: string; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const tablesNeeded = (party: number) => Math.ceil(party / SEATS_PER_TABLE);
export const depositPence = (party: number, rules: Pick<BookingRules, "depositPerPersonPence">) => party * rules.depositPerPersonPence;

/** "2026-11-25" for `now` in the UK. */
export const ukDate = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);

/** The UTC instant of a UK wall-clock time on a UK date ("2026-11-25", minutes since midnight). Handles GMT and BST. */
export function ukWallTime(date: string, minutes: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, Math.floor(minutes / 60), minutes % 60));
  const offsetName = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
    .formatToParts(guess)
    .find((p) => p.type === "timeZoneName")?.value;
  const offsetHours = Number(offsetName?.replace("GMT", "") || 0);
  return new Date(guess.getTime() - offsetHours * 3_600_000);
}

/** ISO weekday (1 = Monday) of a UK date. */
export function isoDayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Today and the next `daysAhead` days, as UK dates with a short label. */
export function bookingDates(now: Date, daysAhead: number): { date: string; label: string }[] {
  const today = ukDate(now);
  const [y, m, d] = today.split("-").map(Number);
  return Array.from({ length: daysAhead + 1 }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i, 12));
    const date = day.toISOString().slice(0, 10);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(day);
    return { date, label };
  });
}

/** Is this UK date one a customer may book (today up to `daysAhead` days ahead)? */
export function isBookableDate(date: string, now: Date, daysAhead: number): boolean {
  return bookingDates(now, daysAhead).some((d) => d.date === date);
}

/**
 * Start times on a date where the whole slot fits inside opening hours,
 * every 30 minutes, and (today) at least 30 minutes from now.
 */
export function startTimes(hours: DayHours[], date: string, now: Date, slotMinutes: number): StartTime[] {
  const day = hours.find((h) => h.iso_day === isoDayOf(date));
  if (!day) return [];
  const opens = toMinutes(day.opens);
  const lastStart = toMinutes(day.closes) - slotMinutes;
  const earliest = now.getTime() + LEAD_MINUTES * 60_000;
  const out: StartTime[] = [];
  for (let t = Math.ceil(opens / START_STEP_MINUTES) * START_STEP_MINUTES; t <= lastStart; t += START_STEP_MINUTES) {
    const start = ukWallTime(date, t);
    if (start.getTime() < earliest) continue;
    out.push({ iso: start.toISOString(), endIso: new Date(start.getTime() + slotMinutes * 60_000).toISOString(), label: hhmm(t) });
  }
  return out;
}

/** Bookable tables with nothing booked overlapping [start, end). */
export function freeTables(tables: BookableTable[], busy: BusyTable[], startIso: string, endIso: string): BookableTable[] {
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  const taken = new Set(busy.filter((b) => new Date(b.startsAt).getTime() < e && new Date(b.endsAt).getTime() > s).map((b) => b.tableId));
  return tables.filter((t) => !taken.has(t.id)).sort((a, b) => a.number - b.number);
}

/** `needed` tables from the free ones: the lowest-numbered run of neighbours if there is one, otherwise the lowest numbers. */
export function pickTables(free: BookableTable[], needed: number): BookableTable[] | null {
  if (needed < 1 || free.length < needed) return null;
  const sorted = [...free].sort((a, b) => a.number - b.number);
  for (let i = 0; i + needed <= sorted.length; i++) {
    const run = sorted.slice(i, i + needed);
    if (run[run.length - 1].number - run[0].number === needed - 1) return run;
  }
  return sorted.slice(0, needed);
}

/** Start times that still have enough free tables for the party. */
export function availableStarts(hours: DayHours[], date: string, now: Date, rules: BookingRules, tables: BookableTable[], busy: BusyTable[], party: number): StartTime[] {
  if (!Number.isInteger(party) || party < 1 || party > rules.maxParty) return [];
  if (!isBookableDate(date, now, rules.daysAhead)) return [];
  const needed = tablesNeeded(party);
  return startTimes(hours, date, now, rules.slotMinutes).filter((s) => freeTables(tables, busy, s.iso, s.endIso).length >= needed);
}

/** Full refund when the customer cancels at least `noticeHours` before the start. */
export function refundDue(startsAtIso: string, now: Date, noticeHours: number): boolean {
  return new Date(startsAtIso).getTime() - now.getTime() >= noticeHours * 3_600_000;
}

/** "Wed 25 Nov, 18:30" in UK time. */
export const bookingWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Stripe can't take a card payment under 30p, so at least this much is always left to pay. */
export const MIN_CARD_PAYMENT_PENCE = 30;

/** Deposit to take off a table order: the unused deposit, leaving at least 30p to pay by card. */
export function depositCredit(depositPence: number, subtotalPence: number, alreadyUsed: boolean): number {
  if (alreadyUsed || depositPence <= 0) return 0;
  return Math.max(0, Math.min(depositPence, subtotalPence - MIN_CARD_PAYMENT_PENCE));
}
