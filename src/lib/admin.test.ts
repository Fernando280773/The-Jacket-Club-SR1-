import { describe, expect, it } from "vitest";
import { fitWithin, formToHours, hoursToForm, penceToPounds, poundsToPence, todaySummary } from "./admin";

describe("prices typed in pounds", () => {
  it("turns pounds into whole pence", () => {
    expect(poundsToPence("7.50")).toBe(750);
    expect(poundsToPence("£7.5")).toBe(750);
    expect(poundsToPence(" 7 ")).toBe(700);
    expect(poundsToPence("0.05")).toBe(5);
    expect(poundsToPence("0")).toBe(0);
    expect(poundsToPence("100")).toBe(10000);
  });
  it("refuses anything else", () => {
    expect(poundsToPence("")).toBeNull();
    expect(poundsToPence("7.505")).toBeNull();
    expect(poundsToPence("-1")).toBeNull();
    expect(poundsToPence("seven")).toBeNull();
    expect(poundsToPence("7,50")).toBeNull();
    expect(poundsToPence("100.01")).toBeNull();
    expect(poundsToPence("20.01", 2000)).toBeNull();
  });
  it("shows pence back as pounds", () => {
    expect(penceToPounds(750)).toBe("7.50");
    expect(penceToPounds(5)).toBe("0.05");
  });
});

describe("opening hours form", () => {
  it("round-trips the week, with missing days closed", () => {
    const form = hoursToForm([{ iso_day: 1, opens: "09:30:00", closes: "22:00:00" }]);
    expect(form).toHaveLength(7);
    expect(form[0]).toEqual({ isoDay: 1, open: true, opens: "09:30", closes: "22:00" });
    expect(form[6].open).toBe(false);
    expect(formToHours(form)).toEqual({ ok: true, hours: [{ iso_day: 1, opens: "09:30", closes: "22:00" }] });
  });
  it("refuses closing before opening", () => {
    const form = hoursToForm([{ iso_day: 2, opens: "11:00", closes: "10:00" }]);
    const r = formToHours(form);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Tuesday");
  });
});

describe("today", () => {
  it("adds up orders and leaves out cancelled ones", () => {
    const o = (total_pence: number, status = "collected") => ({ number: 1, status, type: "collect", total_pence, created_at: "" });
    expect(todaySummary([o(750), o(1250), o(990, "cancelled")])).toEqual({ count: 2, takenPence: 2000, averagePence: 1000 });
    expect(todaySummary([])).toEqual({ count: 0, takenPence: 0, averagePence: 0 });
  });
  it("shrinks big photos and leaves small ones", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
