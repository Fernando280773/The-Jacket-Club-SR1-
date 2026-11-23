import { describe, expect, it } from "vitest";
import { deliveryFeePence, deliverySlots, metresToMiles, navigateUrl, postcodeOf, shortOfDeliveryMinimum, type DeliveryRules } from "./delivery";

const RULES: DeliveryRules = { firstMilePence: 199, perExtraMilePence: 80, maxMiles: 4, minOrderPence: 1200 };

describe("delivery fee (round up each extra mile)", () => {
  it("charges the agreed amounts", () => {
    expect(deliveryFeePence(0.5, RULES)).toBe(199);
    expect(deliveryFeePence(1, RULES)).toBe(199);
    expect(deliveryFeePence(1.1, RULES)).toBe(279);
    expect(deliveryFeePence(2, RULES)).toBe(279);
    expect(deliveryFeePence(2.5, RULES)).toBe(359);
    expect(deliveryFeePence(4, RULES)).toBe(439);
  });
  it("refuses past 4 miles", () => {
    expect(deliveryFeePence(4.01, RULES)).toBeNull();
    expect(deliveryFeePence(4.5, RULES)).toBeNull();
    expect(deliveryFeePence(Number.NaN, RULES)).toBeNull();
  });
  it("turns road metres into miles", () => {
    expect(metresToMiles(1609.344)).toBe(1);
    expect(metresToMiles(4023)).toBe(2.5);
  });
});

describe("£12 minimum", () => {
  it("says how much more food is needed", () => {
    expect(shortOfDeliveryMinimum(950, RULES)).toBe(250);
    expect(shortOfDeliveryMinimum(1200, RULES)).toBe(0);
  });
});

describe("delivery times", () => {
  const hours = [{ iso_day: 1, opens: "09:30", closes: "22:00" }];
  it("start 45 minutes ahead and run to closing", () => {
    // Monday 23 Nov 2026, 12:00 UK.
    const slots = deliverySlots(hours, new Date("2026-11-23T12:00:00Z"));
    expect(slots[0].label).toBe("12:45");
    expect(slots.at(-1)!.label).toBe("22:00");
  });
  it("none once it's too late, or on a closed day", () => {
    expect(deliverySlots(hours, new Date("2026-11-23T21:30:00Z"))).toEqual([]);
    expect(deliverySlots(hours, new Date("2026-11-24T12:00:00Z"))).toEqual([]);
  });
  it("first slot is 45 minutes after opening", () => {
    expect(deliverySlots(hours, new Date("2026-11-23T08:00:00Z"))[0].label).toBe("10:15");
  });
});

describe("driver helpers", () => {
  it("opens Google Maps directions", () => {
    expect(navigateUrl({ latitude: 54.9, longitude: -1.38, address_text: "x", postcode: "y" })).toContain("destination=54.9%2C-1.38");
    expect(navigateUrl({ latitude: null, longitude: null, address_text: "1 High St", postcode: "SR1 1AA" })).toContain("1%20High%20St%2C%20SR1%201AA");
  });
  it("finds a postcode", () => {
    expect(postcodeOf("12-14 Park Lane, Sunderland, SR1 3NX, United Kingdom")).toBe("SR1 3NX");
    expect(postcodeOf("no postcode")).toBe("");
  });
});
