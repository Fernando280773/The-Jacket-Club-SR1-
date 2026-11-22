/** Opening hours for one weekday. iso_day: 1 = Monday … 7 = Sunday. Times are "HH:MM" or "HH:MM:SS" in UK time. */
export type DayHours = { iso_day: number; opens: string; closes: string };

export type OpenStatus = { isOpen: boolean; label: string };

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SHORT_DAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

/** The weekday and minutes-since-midnight of `now` in the shop's time zone (Europe/London, so BST is handled). */
export function londonClock(now: Date): { isoDay: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { isoDay: SHORT_DAYS[get("weekday")], minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const hhmm = (t: string) => t.slice(0, 5);

/** Open from `opens` (inclusive) until `closes` (exclusive): open at 09:30, closed at 22:00. */
export function getOpenStatus(hours: DayHours[], now: Date): OpenStatus {
  const { isoDay, minutes } = londonClock(now);
  const today = hours.find((h) => h.iso_day === isoDay);

  if (today && minutes >= toMinutes(today.opens) && minutes < toMinutes(today.closes)) {
    return { isOpen: true, label: `Open now · closes ${hhmm(today.closes)}` };
  }
  if (today && minutes < toMinutes(today.opens)) {
    return { isOpen: false, label: `Closed · opens ${hhmm(today.opens)}` };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const day = ((isoDay - 1 + ahead) % 7) + 1;
    const next = hours.find((h) => h.iso_day === day);
    if (next) {
      const when = ahead === 1 ? "tomorrow" : DAY_NAMES[day];
      return { isOpen: false, label: `Closed · opens ${when} ${hhmm(next.opens)}` };
    }
  }
  return { isOpen: false, label: "Closed" };
}

/** True before the shop's opening day (10 December 2026, UK time). */
export function isBeforeOpeningDay(now: Date, openingDay = "2026-12-10"): boolean {
  const londonDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
  return londonDate < openingDay;
}
