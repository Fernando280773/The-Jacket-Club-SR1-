import { describe, expect, it } from "vitest";
import { formatPence } from "./money";

describe("formatPence", () => {
  it("formats whole pence as pounds", () => {
    expect(formatPence(795)).toBe("£7.95");
    expect(formatPence(1200)).toBe("£12.00");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(0)).toBe("£0.00");
  });

  it("handles negative amounts (refunds)", () => {
    expect(formatPence(-199)).toBe("-£1.99");
  });

  it("refuses fractions of a penny", () => {
    expect(() => formatPence(7.5)).toThrow();
  });
});
