import { describe, expect, it } from "vitest";
import { buildReceipt, type ReceiptOrder } from "./receipt";

const order: ReceiptOrder = {
  number: 1003,
  type: "collect",
  pickup_at: "2026-12-14T12:30:00Z",
  total_pence: 1860,
  created_at: "2026-12-14T12:05:00Z",
  customer_name: "Antony <Fernando>",
  dining_tables: null,
  order_lines: [
    { item_name: "The Classic", quantity: 2, line_total_pence: 1860, order_line_options: [{ option_name: "Cheese", count: 1 }, { option_name: "Can + fries", count: 1 }] },
  ],
};

describe("receipt email", () => {
  it("matches the saved order: number, lines, options, total and pickup time", () => {
    const r = buildReceipt(order, "https://example.com/order/abc");
    expect(r.subject).toBe("Your Jacket Club order #1003");
    expect(r.text).toContain("2 x The Classic (Cheese · Can + fries): £18.60");
    expect(r.text).toContain("Total paid: £18.60");
    expect(r.text).toContain("Collect from 12–14 Park Lane at 12:30");
    expect(r.html).toContain("https://example.com/order/abc");
  });
  it("includes VAT and company details", () => {
    const r = buildReceipt(order, "x");
    expect(r.text).toContain("Prices include VAT.");
    expect(r.text).toContain("Fernando & Sons Property Ltd trading as The Jacket Club SR1");
  });
  it("escapes customer text in the HTML", () => {
    const r = buildReceipt(order, "x");
    expect(r.html).not.toContain("<Fernando>");
    expect(r.html).toContain("Thank you, Antony!");
  });
  it("table orders show the table", () => {
    const r = buildReceipt({ ...order, type: "table", pickup_at: null, dining_tables: { number: 7 } }, "x");
    expect(r.text).toContain("We'll bring it to table 7");
  });
});
