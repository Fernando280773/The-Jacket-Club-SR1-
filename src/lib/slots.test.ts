import { describe, expect, it } from "vitest";
import { pickupSlots } from "./slots";
import type { DayHours } from "./opening";

const HOURS: DayHours[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ iso_day: d, opens: d === 7 ? "11:00:00" : "09:30:00", closes: "22:00:00" }));
const labels = (iso: string) => pickupSlots(HOURS, new Date(iso)).map((s) => s.label);

describe("collection times", () => {
  it("before opening on Sunday, the first slot is 11:00", () => {
    const l = labels("2026-12-13T08:05:00Z");
    expect(l[0]).toBe("11:00");
    expect(l.at(-1)).toBe("21:45");
    expect(l).toHaveLength(44);
  });
  it("during the day, the first slot is at least 15 minutes away, rounded up to the quarter hour", () => {
    expect(labels("2026-12-14T12:07:00Z")[0]).toBe("12:30");
    expect(labels("2026-12-14T12:00:00Z")[0]).toBe("12:15");
  });
  it("at 21:50 collection is closed for today", () => {
    expect(labels("2026-12-14T21:50:00Z")).toEqual([]);
    expect(labels("2026-12-14T21:30:00Z")).toEqual(["21:45"]);
  });
  it("slot times are real UK times in summer (BST)", () => {
    const s = pickupSlots(HOURS, new Date("2027-06-14T08:00:00Z"))[0];
    expect(s.label).toBe("09:30");
    expect(s.iso).toBe("2027-06-14T08:30:00.000Z");
  });
  it("slot times are real UK times in winter (GMT)", () => {
    expect(pickupSlots(HOURS, new Date("2026-12-14T08:00:00Z"))[0].iso).toBe("2026-12-14T09:30:00.000Z");
  });
});
