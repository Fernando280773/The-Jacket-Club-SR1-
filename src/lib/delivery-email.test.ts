import { describe, expect, it } from "vitest";
import { buildOnItsWay, type OnItsWayOrder } from "./delivery-email";

const order: OnItsWayOrder = { number: 1015, customer_name: "Antony <Fernando>", deliveries: { address_text: "1 High Street <b>, Sunderland" } };

describe("on its way email", () => {
  it("names the order, the address and the tracking link", () => {
    const r = buildOnItsWay(order, "https://example.com/order/abc");
    expect(r.subject).toBe("Your Jacket Club order #1015 is on its way");
    expect(r.text).toContain("heading to 1 High Street <b>, Sunderland");
    expect(r.text).toContain("Track your order: https://example.com/order/abc");
    expect(r.html).toContain('href="https://example.com/order/abc"');
    expect(r.text).toContain("company number 15466129");
  });
  it("escapes customer text in the HTML", () => {
    const r = buildOnItsWay(order, "x");
    expect(r.html).not.toContain("<Fernando>");
    expect(r.html).not.toContain("<b>");
    expect(r.html).toContain("Antony, your order #1015 is on its way");
  });
  it("still reads well without a name or address", () => {
    const r = buildOnItsWay({ number: 7, customer_name: null, deliveries: null }, "x");
    expect(r.html).toContain("Your order #7 is on its way");
    expect(r.text).toContain("Our driver has picked it up.");
  });
});
