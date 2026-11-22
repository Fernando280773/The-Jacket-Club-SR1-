import { describe, expect, it } from "vitest";
import { checkDetails, normaliseUkMobile, stripeLineItems } from "./checkout";

describe("customer details", () => {
  it("accepts UK mobiles in common formats", () => {
    expect(normaliseUkMobile("07700 900123")).toBe("+447700900123");
    expect(normaliseUkMobile("+44 7700 900123")).toBe("+447700900123");
    expect(normaliseUkMobile("(07700) 900-123")).toBe("+447700900123");
  });
  it("refuses landlines and short numbers", () => {
    expect(normaliseUkMobile("0191 123 4567")).toBeNull();
    expect(normaliseUkMobile("07700 9001")).toBeNull();
  });
  it("needs a name and mobile; email is optional but must look right", () => {
    expect(checkDetails({ name: "Antony", phone: "07700900123", email: "" })).toEqual({});
    const e = checkDetails({ name: " ", phone: "123", email: "not-an-email" });
    expect(Object.keys(e).sort()).toEqual(["email", "name", "phone"]);
  });
});

describe("Stripe line items", () => {
  it("charge the server price per line", () => {
    const items = stripeLineItems({
      itemCount: 2,
      subtotalPence: 1860,
      isValid: true,
      lines: [{ id: "a", itemCode: "J01", name: "The Classic", details: "Cheese · Can + fries", quantity: 2, unitPricePence: 930, lineTotalPence: 1860, errors: [] }],
    });
    expect(items).toEqual([
      { quantity: 2, price_data: { currency: "gbp", unit_amount: 930, product_data: { name: "The Classic", description: "Cheese · Can + fries" } } },
    ]);
  });
});
