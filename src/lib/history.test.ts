import { describe, expect, it } from "vitest";
import { allPacked, needsPacking, poundsToPence, ukDate } from "./history";

describe("packing checklist", () => {
  it("applies to collections and deliveries being prepared, not table orders", () => {
    expect(needsPacking("collect", "preparing")).toBe(true);
    expect(needsPacking("delivery", "preparing")).toBe(true);
    expect(needsPacking("table", "preparing")).toBe(false);
    expect(needsPacking("collect", "received")).toBe(false);
    expect(needsPacking("collect", "ready")).toBe(false);
  });

  it("is complete only when every line is ticked", () => {
    expect(allPacked(["a", "b"], new Set(["a"]))).toBe(false);
    expect(allPacked(["a", "b"], new Set(["a", "b"]))).toBe(true);
    expect(allPacked([], new Set())).toBe(false);
  });
});

describe("poundsToPence", () => {
  it("reads pounds as whole pence", () => {
    expect(poundsToPence("3")).toBe(300);
    expect(poundsToPence("3.5")).toBe(350);
    expect(poundsToPence("£12.99")).toBe(1299);
  });
  it("refuses anything else", () => {
    expect(poundsToPence("")).toBeNull();
    expect(poundsToPence("3.999")).toBeNull();
    expect(poundsToPence("-2")).toBeNull();
    expect(poundsToPence("abc")).toBeNull();
  });
});

describe("ukDate", () => {
  it("uses the UK calendar day", () => {
    expect(ukDate(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01"); // BST
    expect(ukDate(new Date("2026-12-10T12:00:00Z"), 1)).toBe("2026-12-09");
  });
});
