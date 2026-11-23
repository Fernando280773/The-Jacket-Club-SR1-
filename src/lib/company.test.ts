import { describe, expect, it } from "vitest";
import { buildBookingEmail } from "./booking-email";
import { COMPANY, COMPANY_LINE, LEGAL_PAGES } from "./company";
import { buildReceipt } from "./receipt";

describe("company details", () => {
  it("has the trading disclosures the law requires", () => {
    expect(COMPANY_LINE).toContain("Fernando & Sons Property Limited");
    expect(COMPANY_LINE).toContain("company number 15466129");
    expect(COMPANY_LINE).toContain("registered in England and Wales");
    expect(COMPANY_LINE).toContain("1–3 Park Lane, Sunderland SR1 3NX");
    expect(COMPANY.vatNumber).toBeNull();
  });
  it("is the same line in the receipt and booking emails", () => {
    const receipt = buildReceipt(
      { number: 1, type: "collect", pickup_at: null, total_pence: 550, created_at: "2026-11-23T12:00:00Z", customer_name: "A", dining_tables: null, order_lines: [] },
      "u",
    );
    const booking = buildBookingEmail({ customer_name: "A", starts_at: "2026-11-25T18:00:00Z", ends_at: "2026-11-25T20:00:00Z", party_size: 2, deposit_pence: 400, tables: [1] }, "u", 2);
    expect(receipt.text).toContain(COMPANY_LINE);
    expect(booking.text).toContain(COMPANY_LINE);
  });
  it("lists the five legal pages", () => {
    expect(LEGAL_PAGES.map((p) => p.href)).toEqual(["/terms", "/refunds", "/privacy", "/cookies", "/allergens"]);
  });
});
