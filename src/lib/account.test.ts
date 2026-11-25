import { describe, expect, it } from "vitest";
import { currentOrders, orderSummary, reorderLines, suggestions, type PastOrder } from "./account";
import type { MenuItem, OptionGroup } from "./menu";
import type { PricingMenu } from "./pricing";

const item = (code: string, name: string, extra: Partial<MenuItem> = {}): MenuItem => ({
  code, name, description: null, pricePence: 500, isHalal: true, isAvailable: true, isFeatured: false, photoUrl: null, allergens: [], groupCodes: [], ...extra,
});
const filling: OptionGroup = {
  code: "FILL", name: "Choose a filling", required: true, min: 1, max: 1, control: "pick_one",
  options: [
    { id: "o-cheese", name: "Cheese", priceChangePence: 0, isAvailable: true, allergens: [] },
    { id: "o-tuna", name: "Tuna", priceChangePence: 0, isAvailable: false, allergens: [] },
  ],
};
const items = [
  item("J01", "The Classic", { groupCodes: ["FILL"], isFeatured: true }),
  item("F01", "Fries"),
  item("W01", "Wrap", { isFeatured: true }),
  item("S01", "Soup", { isAvailable: false }),
  item("BK1", "Full Breakfast"),
  item("C02", "Bottled Water"),
];
const menu = {
  categories: [
    { name: "Jackets", slug: "jackets", items: items.filter((i) => ["J01", "F01", "W01", "S01", "C02"].includes(i.code)) },
    { name: "Breakfast (all day)", slug: "breakfast", items: items.filter((i) => i.code === "BK1") },
  ],
  groups: { FILL: filling },
};
const pricing: PricingMenu = { items: Object.fromEntries(items.map((i) => [i.code, i])), groups: { FILL: filling } };

const order = (n: number, status: PastOrder["status"], lines: PastOrder["lines"]): PastOrder => ({
  id: `o${n}`, number: n, type: "collect", status, created_at: new Date(2026, 10, n).toISOString(), pickup_at: null, total_pence: 500, access_token: "t".repeat(32), lines,
});
const line = (code: string | null, name: string, options: PastOrder["lines"][number]["options"] = [], quantity = 1) => ({
  item_code: code, item_name: name, quantity, line_total_pence: 500 * quantity, options,
});
const cheese = { option_id: "o-cheese", group_code: "FILL", option_name: "Cheese", count: 1 };
const tuna = { option_id: "o-tuna", group_code: "FILL", option_name: "Tuna", count: 1 };
const afternoon = new Date("2026-11-24T15:00:00Z");
const morning = new Date("2026-11-24T08:00:00Z");

describe("reorder", () => {
  it("rebuilds lines with their choices and quantities", () => {
    const r = reorderLines(order(1, "collected", [line("J01", "The Classic", [cheese], 2), line("F01", "Fries")]), pricing);
    expect(r.lines).toEqual([
      { itemCode: "J01", choices: { FILL: { "o-cheese": 1 } }, quantity: 2 },
      { itemCode: "F01", choices: {}, quantity: 1 },
    ]);
    expect(r.skipped).toEqual([]);
  });
  it("leaves out sold-out items, sold-out choices and items no longer on the menu", () => {
    const r = reorderLines(order(1, "collected", [line("S01", "Soup"), line("J01", "The Classic", [tuna]), line(null, "Old item"), line("F01", "Fries")]), pricing);
    expect(r.lines.map((l) => l.itemCode)).toEqual(["F01"]);
    expect(r.skipped).toEqual(["Soup", "The Classic", "Old item"]);
  });
});

describe("suggestions", () => {
  const history = [
    order(3, "collected", [line("J01", "The Classic", [cheese]), line("F01", "Fries")]),
    order(2, "collected", [line("J01", "The Classic", [cheese])]),
    order(1, "cancelled", [line("F01", "Fries")]),
  ];
  it("finds the usual (two or more orders) and the last order", () => {
    const s = suggestions(history, menu, pricing, [], afternoon);
    expect(s.usual?.item.code).toBe("J01");
    expect(s.usual?.times).toBe(2);
    expect(s.last?.number).toBe(3);
  });
  it("has no usual after just one order", () => {
    expect(suggestions([history[0]], menu, pricing, [], afternoon).usual).toBeNull();
  });
  it("suggests popular items they haven't tried, never sold-out ones", () => {
    const s = suggestions(history, menu, pricing, ["S01", "J01", "C02", "W01"], afternoon);
    expect(s.tryNew.map((i) => i.code)).toEqual(["C02", "W01"]);
  });
  it("puts breakfast first in the morning", () => {
    const s = suggestions(history, menu, pricing, ["C02"], morning);
    expect(s.tryNew[0].code).toBe("BK1");
  });
  it("skips an order that can't be ordered again", () => {
    const s = suggestions([order(5, "collected", [line("S01", "Soup")]), ...history], menu, pricing, [], afternoon);
    expect(s.last?.number).toBe(3);
  });
});

describe("helpers", () => {
  it("lists only orders still on their way", () => {
    expect(currentOrders([order(1, "ready", []), order(2, "collected", []), order(3, "out_for_delivery", [])]).map((o) => o.number)).toEqual([1, 3]);
  });
  it("summarises items", () => {
    expect(orderSummary(order(1, "ready", [line("J01", "The Classic", [], 2), line("F01", "Fries")]))).toBe("2 × The Classic, Fries");
  });
});
