import { describe, expect, it } from "vitest";
import { buildBookingEmail, tablesText } from "./booking-email";

describe("booking email", () => {
  const b = { customer_name: "Sam <b>Smith</b>", starts_at: "2026-11-25T18:30:00Z", ends_at: "2026-11-25T20:30:00Z", party_size: 4, deposit_pence: 800, tables: [2, 1] };
  it("has the time, party, tables, deposit and manage link", () => {
    const e = buildBookingEmail(b, "https://example.com/booking/abc", 2);
    expect(e.subject).toContain("Wed 25 Nov");
    expect(e.text).toContain("18:30 to 20:30");
    expect(e.text).toContain("4 people · Tables 1, 2");
    expect(e.text).toContain("£8.00");
    expect(e.text).toContain("at least 2 hours before");
    expect(e.html).toContain("https://example.com/booking/abc");
  });
  it("escapes names", () => {
    expect(buildBookingEmail({ ...b, customer_name: "<script>" }, "u", 2).html).not.toContain("<script>");
  });
  it("names one or more tables", () => {
    expect(tablesText([7])).toBe("Table 7");
    expect(tablesText([3, 2])).toBe("Tables 2, 3");
  });
});
