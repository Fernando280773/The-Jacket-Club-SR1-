import { describe, expect, it } from "vitest";
import { labelHeight, labelRows, parseLabel, SAMPLE_LABEL, serviceLine, wrap } from "./label";

describe("label content", () => {
  it("reads the database's label row", () => {
    const l = parseLabel({
      position: 2, total: 3, name: "Sam", number: 1008, type: "delivery", pickup_at: "2026-12-10T12:15:00Z", table_number: null,
      created_at: "2026-12-10T11:50:00Z", staff_test: true, token: "0123456789abcdef0123456789abcdef", item_name: "The Classic",
      options: [{ name: "Beans", count: 1 }, { name: "Cheese", count: 2 }, "junk"], allergens: ["Milk", 7],
    });
    expect(l).toMatchObject({ position: 2, total: 3, name: "Sam", type: "delivery", staffTest: true, itemName: "The Classic", allergens: ["Milk"] });
    expect(l?.options).toEqual([{ name: "Beans", count: 1 }, { name: "Cheese", count: 2 }]);
  });
  it("refuses rows that aren't labels, and drops a token that isn't a tracking token", () => {
    expect(parseLabel(null)).toBeNull();
    expect(parseLabel({ type: "book", item_name: "x" })).toBeNull();
    expect(parseLabel({ type: "collect", item_name: "x", token: "../admin" })?.token).toBeNull();
  });
  it("says how the order leaves the kitchen, in UK time", () => {
    expect(serviceLine({ type: "collect", pickupAt: "2026-12-10T11:30:00Z", tableNumber: null })).toBe("COLLECT 11:30");
    expect(serviceLine({ type: "delivery", pickupAt: "2026-07-01T11:30:00Z", tableNumber: null })).toBe("DELIVERY 12:30");
    expect(serviceLine({ type: "table", pickupAt: null, tableNumber: 4 })).toBe("TABLE 4");
  });
  it("wraps long text on spaces and splits a word that is too long", () => {
    expect(wrap("Tuna Mayo & Sweetcorn", 12)).toEqual(["Tuna Mayo &", "Sweetcorn"]);
    expect(wrap("Supercalifragilistic", 8)).toEqual(["Supercal", "ifragili", "stic"]);
  });
});

describe("label layout", () => {
  const rows = labelRows(SAMPLE_LABEL);
  const text = rows.map((r) => ("text" in r ? r.text : r.kind === "head" ? `${r.count} ${r.name} ${r.order}` : "")).join("\n");
  it("shows the count, name, order number, time, item, every option and the allergens", () => {
    expect(text).toContain("2 of 3 Sam #1008");
    expect(text).toContain("COLLECT 11:30");
    expect(text).toContain("Tuna Mayo &");
    expect(text).toContain("+ Extra cheese x2");
    expect(text).toContain("Contains: Eggs, Fish,");
    expect(text).toContain("Milk, Mustard");
  });
  it("always prints an allergen line, even when there are none", () => {
    const none = labelRows({ ...SAMPLE_LABEL, allergens: [] });
    expect(none.some((r) => r.kind === "allergen" && r.text === "No allergens listed")).toBe(true);
  });
  it("marks staff test orders", () => {
    expect(rows.some((r) => r.kind === "test")).toBe(false);
    expect(labelRows({ ...SAMPLE_LABEL, staffTest: true }).some((r) => r.kind === "test")).toBe(true);
  });
  it("gets longer with more options, and has no QR code without a tracking token", () => {
    const more = labelRows({ ...SAMPLE_LABEL, options: [...SAMPLE_LABEL.options, { name: "Coleslaw", count: 1 }] });
    expect(labelHeight(more)).toBe(labelHeight(rows) + 32);
    const foot = labelRows({ ...SAMPLE_LABEL, token: null }).at(-1);
    expect(foot).toMatchObject({ kind: "foot", hasQr: false });
  });
  it("fits more letters per line on a wider (80 mm) roll", () => {
    expect(labelRows(SAMPLE_LABEL, 576).filter((r) => r.kind === "item")).toHaveLength(1);
  });
});
