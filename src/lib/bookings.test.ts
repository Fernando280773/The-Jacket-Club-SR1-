import { describe, expect, it } from "vitest";
import {
  availableStarts,
  bookingDates,
  depositCredit,
  depositPence,
  freeTables,
  isBookableDate,
  pickTables,
  refundDue,
  startTimes,
  tablesNeeded,
  ukWallTime,
  type BookingRules,
} from "./bookings";

const HOURS = [1, 2, 3, 4, 5, 6].map((d) => ({ iso_day: d, opens: "09:30", closes: "22:00" })).concat([{ iso_day: 7, opens: "11:00", closes: "22:00" }]);
const RULES: BookingRules = { slotMinutes: 120, daysAhead: 7, maxParty: 20, depositPerPersonPence: 200, refundNoticeHours: 2 };
const TABLES = Array.from({ length: 10 }, (_, i) => ({ id: `t${i + 1}`, number: i + 1 }));
// Sunday 22 Nov 2026, 19:00 UK (GMT).
const NOW = new Date("2026-11-22T19:00:00Z");

describe("tables and deposit", () => {
  it("needs one table per two people", () => {
    expect(tablesNeeded(1)).toBe(1);
    expect(tablesNeeded(2)).toBe(1);
    expect(tablesNeeded(7)).toBe(4);
    expect(tablesNeeded(20)).toBe(10);
  });
  it("charges £2 a person", () => {
    expect(depositPence(7, RULES)).toBe(1400);
  });
  it("takes the deposit off once, always leaving 30p to pay", () => {
    expect(depositCredit(1400, 3000, false)).toBe(1400);
    expect(depositCredit(1400, 1000, false)).toBe(970);
    expect(depositCredit(1400, 20, false)).toBe(0);
    expect(depositCredit(1400, 3000, true)).toBe(0);
  });
});

describe("dates and times", () => {
  it("offers today and the next 7 days only", () => {
    const dates = bookingDates(NOW, 7);
    expect(dates).toHaveLength(8);
    expect(dates[0]).toEqual({ date: "2026-11-22", label: "Today" });
    expect(dates[1].label).toBe("Tomorrow");
    expect(dates[7].date).toBe("2026-11-29");
    expect(isBookableDate("2026-11-30", NOW, 7)).toBe(false);
    expect(isBookableDate("2026-11-21", NOW, 7)).toBe(false);
  });
  it("fits the whole 2 hours inside opening hours, every 30 minutes", () => {
    const times = startTimes(HOURS, "2026-11-25", NOW, 120).map((t) => t.label);
    expect(times[0]).toBe("09:30");
    expect(times.at(-1)).toBe("20:00");
    expect(times).toHaveLength(22);
  });
  it("starts today's times at least 30 minutes from now", () => {
    // 19:00 now → 19:30 is the first; last start 20:00 on a Sunday.
    expect(startTimes(HOURS, "2026-11-22", NOW, 120).map((t) => t.label)).toEqual(["19:30", "20:00"]);
  });
  it("has no times on a closed day", () => {
    expect(startTimes(HOURS.filter((h) => h.iso_day !== 3), "2026-11-25", NOW, 120)).toEqual([]);
  });
  it("uses UK time in summer", () => {
    expect(ukWallTime("2026-07-01", 18 * 60).toISOString()).toBe("2026-07-01T17:00:00.000Z");
    expect(ukWallTime("2026-11-25", 18 * 60).toISOString()).toBe("2026-11-25T18:00:00.000Z");
  });
});

describe("free tables", () => {
  const busy = [
    { tableId: "t1", startsAt: "2026-11-25T18:00:00Z", endsAt: "2026-11-25T20:00:00Z" },
    { tableId: "t2", startsAt: "2026-11-25T18:00:00Z", endsAt: "2026-11-25T20:00:00Z" },
  ];
  it("a table booked 18:00–20:00 is free again at 20:00 but not at 19:30", () => {
    expect(freeTables(TABLES, busy, "2026-11-25T20:00:00Z", "2026-11-25T22:00:00Z")).toHaveLength(10);
    expect(freeTables(TABLES, busy, "2026-11-25T19:30:00Z", "2026-11-25T21:30:00Z")).toHaveLength(8);
    expect(freeTables(TABLES, busy, "2026-11-25T16:00:00Z", "2026-11-25T18:00:00Z")).toHaveLength(10);
  });
  it("picks neighbouring tables where it can", () => {
    const free = TABLES.filter((t) => ![3, 5].includes(t.number));
    expect(pickTables(free, 3)!.map((t) => t.number)).toEqual([6, 7, 8]);
    expect(pickTables(free, 2)!.map((t) => t.number)).toEqual([1, 2]);
    expect(pickTables(TABLES.filter((t) => t.number % 2 === 1), 2)!.map((t) => t.number)).toEqual([1, 3]);
    expect(pickTables(free, 9)).toBeNull();
  });
  it("hides a time once there aren't enough tables for the party", () => {
    const allBusy = TABLES.slice(0, 9).map((t) => ({ tableId: t.id, startsAt: "2026-11-25T18:00:00Z", endsAt: "2026-11-25T20:00:00Z" }));
    const forTwo = availableStarts(HOURS, "2026-11-25", NOW, RULES, TABLES, allBusy, 2).map((t) => t.label);
    const forFour = availableStarts(HOURS, "2026-11-25", NOW, RULES, TABLES, allBusy, 4).map((t) => t.label);
    expect(forTwo).toContain("18:00");
    expect(forFour).not.toContain("18:00");
    expect(forFour).not.toContain("17:00");
    expect(forFour).toContain("16:00");
    expect(forFour).toContain("20:00");
  });
  it("refuses parties over 20 and dates past 7 days", () => {
    expect(availableStarts(HOURS, "2026-11-25", NOW, RULES, TABLES, [], 21)).toEqual([]);
    expect(availableStarts(HOURS, "2026-12-01", NOW, RULES, TABLES, [], 2)).toEqual([]);
  });
});

describe("refunds", () => {
  it("refunds at exactly 2 hours before, not a minute later", () => {
    expect(refundDue("2026-11-25T18:00:00Z", new Date("2026-11-25T16:00:00Z"), 2)).toBe(true);
    expect(refundDue("2026-11-25T18:00:00Z", new Date("2026-11-25T16:01:00Z"), 2)).toBe(false);
  });
});
