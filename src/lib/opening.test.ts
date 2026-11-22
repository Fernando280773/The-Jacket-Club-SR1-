import { describe, expect, it } from "vitest";
import { getOpenStatus, isBeforeOpeningDay, type DayHours } from "./opening";

// The shop's real hours: Mon–Sat 09:30–22:00, Sun 11:00–22:00.
const HOURS: DayHours[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  iso_day: d,
  opens: d === 7 ? "11:00:00" : "09:30:00",
  closes: "22:00:00",
}));

// 2026-12-13 is a Sunday, 2026-12-14 a Monday (GMT, so UTC = UK time).
const at = (iso: string) => new Date(iso);

describe("open or closed (UK time)", () => {
  it("Sunday 10:59 is closed, opening at 11:00", () => {
    expect(getOpenStatus(HOURS, at("2026-12-13T10:59:00Z"))).toEqual({ isOpen: false, label: "Closed · opens 11:00" });
  });
  it("Sunday 11:00 is open", () => {
    expect(getOpenStatus(HOURS, at("2026-12-13T11:00:00Z"))).toEqual({ isOpen: true, label: "Open now · closes 22:00" });
  });
  it("Monday 09:29 is closed", () => {
    expect(getOpenStatus(HOURS, at("2026-12-14T09:29:00Z")).isOpen).toBe(false);
  });
  it("Monday 09:30 is open", () => {
    expect(getOpenStatus(HOURS, at("2026-12-14T09:30:00Z")).isOpen).toBe(true);
  });
  it("22:00 is closed and says when it opens tomorrow", () => {
    expect(getOpenStatus(HOURS, at("2026-12-14T22:00:00Z"))).toEqual({ isOpen: false, label: "Closed · opens tomorrow 09:30" });
  });
  it("Saturday night points to Sunday's 11:00 opening", () => {
    expect(getOpenStatus(HOURS, at("2026-12-12T23:30:00Z")).label).toBe("Closed · opens tomorrow 11:00");
  });
  it("uses British Summer Time in summer (09:30 BST = 08:30 UTC)", () => {
    expect(getOpenStatus(HOURS, at("2027-06-14T08:30:00Z")).isOpen).toBe(true);
    expect(getOpenStatus(HOURS, at("2027-06-14T08:29:00Z")).isOpen).toBe(false);
  });
});

describe("opening day banner", () => {
  it("shows before 10 December", () => {
    expect(isBeforeOpeningDay(at("2026-12-09T23:59:00Z"))).toBe(true);
  });
  it("is gone on 10 December", () => {
    expect(isBeforeOpeningDay(at("2026-12-10T00:00:00Z"))).toBe(false);
  });
});
