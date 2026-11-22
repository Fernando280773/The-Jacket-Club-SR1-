import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { MenuItem, OptionControl, OptionGroup } from "./menu";
import { checkChoices, lineAllergens, parseLines, priceBasket, sameChoices, unitPricePence, type Choices, type PricingMenu } from "./pricing";

// Build the pricing menu from the real menu data (the same snapshot that loads the database).
type MenuJson = {
  items: { code: string; name: string; price_pence: number; option_groups: string[]; allergens: string[] }[];
  option_groups: { code: string; name: string; required: boolean; min: number; max: number; control: OptionControl }[];
  options: { group: string; name: string; price_change_pence: number; allergens: string[] }[];
};
const json: MenuJson = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/menu.json"), "utf8"));
const ALLERGEN_IDS: Record<string, number> = { Celery: 1, Gluten: 2, Crustaceans: 3, Eggs: 4, Fish: 5, Lupin: 6, Milk: 7, Molluscs: 8, Mustard: 9, "Tree nuts": 10, Peanuts: 11, Sesame: 12, Soya: 13, Sulphites: 14 };
const allergens = (names: string[]) => names.map((n) => ({ id: ALLERGEN_IDS[n], name: n }));
const optId = (group: string, name: string) => `${group}:${name}`;

const groups: Record<string, OptionGroup> = {};
for (const g of json.option_groups) {
  groups[g.code] = {
    ...g,
    options: json.options
      .filter((o) => o.group === g.code)
      .map((o) => ({ id: optId(o.group, o.name), name: o.name, priceChangePence: o.price_change_pence, isAvailable: true, allergens: allergens(o.allergens) })),
  };
}
const items: Record<string, MenuItem> = {};
for (const i of json.items) {
  items[i.code] = { code: i.code, name: i.name, description: null, pricePence: i.price_pence, isHalal: true, isAvailable: true, isFeatured: false, photoUrl: null, allergens: allergens(i.allergens), groupCodes: i.option_groups };
}
const menu: PricingMenu = { items, groups };
const pick = (...pairs: [string, string, number?][]): Choices => {
  const c: Choices = {};
  for (const [g, name, n] of pairs) (c[g] ??= {})[optId(g, name)] = n ?? 1;
  return c;
};

describe("prices (whole pence)", () => {
  it("The Classic + cheese second filling + can and fries = £9.30, two = £18.60", () => {
    const choices = pick(["G_JFILL2", "Cheese"], ["G_MEAL", "Can + fries"]);
    expect(checkChoices(items.J01, groups, choices)).toEqual([]);
    expect(unitPricePence(items.J01, groups, choices)).toBe(930);
    const basket = priceBasket(menu, [{ id: "a", itemCode: "J01", choices, quantity: 2 }]);
    expect(basket.subtotalPence).toBe(1860);
    expect(basket.itemCount).toBe(2);
    expect(basket.isValid).toBe(true);
  });

  it("Chicken Curry Rice Box + cheese + a can = £8.95", () => {
    const choices = pick(["G_RICEX", "Add cheese"], ["G_ADDCAN", "Add a can"]);
    expect(checkChoices(items.R01, groups, choices)).toEqual([]);
    expect(unitPricePence(items.R01, groups, choices)).toBe(895);
  });

  it("counters multiply: Full Club with 2 extra eggs = £8.95 + 2 × £0.80", () => {
    const choices = pick(["G_EGG", "Fried"], ["G_TOASTTYPE", "White"], ["G_BFEXTRA", "Egg", 2]);
    expect(checkChoices(items.F01, groups, choices)).toEqual([]);
    expect(unitPricePence(items.F01, groups, choices)).toBe(1055);
  });

  it("ignores any price sent from the phone", () => {
    const tampered = [{ id: "x", itemCode: "J01", choices: {}, quantity: 1, pricePence: 1, unitPricePence: 1, name: "Free" }];
    const basket = priceBasket(menu, parseLines(tampered));
    expect(basket.subtotalPence).toBe(550);
    expect(basket.lines[0].name).toBe("The Classic");
  });
});

describe("rules", () => {
  it("refuses a wrap without choosing toasted or cold", () => {
    expect(checkChoices(items.W01, groups, {})).toContain("Choose wrap style");
    expect(checkChoices(items.W01, groups, pick(["G_TOAST", "Toasted"]))).toEqual([]);
  });
  it("refuses a 4th sauce", () => {
    expect(checkChoices(items.J01, groups, pick(["G_SAUCE", "Garlic mayo", 3]))).toEqual([]);
    expect(checkChoices(items.J01, groups, pick(["G_SAUCE", "Garlic mayo", 3], ["G_SAUCE", "Ketchup", 1]))).toContain("Sauces: up to 3");
  });
  it("refuses a 3rd bap filling", () => {
    const three = pick(["G_BAPFILL", "Chicken sausage"], ["G_BAPFILL", "Turkey bacon"], ["G_BAPFILL", "Fried egg"]);
    expect(checkChoices(items.F04, groups, three)).toContain("Bap fillings: up to 2");
  });
  it("refuses nuggets with no dip", () => {
    expect(checkChoices(items.H01, groups, {})).toContain("Choose your dip");
  });
  it("refuses two of a pick-one option, unknown options and options from another item", () => {
    expect(checkChoices(items.J01, groups, pick(["G_JFILL2", "Cheese", 2])).length).toBeGreaterThan(0);
    expect(checkChoices(items.J01, groups, { G_JFILL2: { "made-up": 1 } })).toContain("Unknown option in Add a second filling");
    expect(checkChoices(items.J01, groups, pick(["G_DIP", "Ketchup"]))).toContain('The Classic has no "G_DIP" choice');
  });
  it("refuses sold-out items and options", () => {
    const soldOut = { ...items.J01, isAvailable: false };
    expect(checkChoices(soldOut, groups, {})).toContain("The Classic is sold out");
    const g = { ...groups, G_JFILL2: { ...groups.G_JFILL2, options: groups.G_JFILL2.options.map((o) => ({ ...o, isAvailable: o.name !== "Cheese" })) } };
    expect(checkChoices(items.J01, g, pick(["G_JFILL2", "Cheese"]))).toContain("Cheese is sold out");
  });
  it("refuses quantities outside 1–20 and unknown items", () => {
    expect(priceBasket(menu, [{ id: "a", itemCode: "J01", choices: {}, quantity: 0 }]).isValid).toBe(false);
    expect(priceBasket(menu, [{ id: "a", itemCode: "J01", choices: {}, quantity: 21 }]).isValid).toBe(false);
    expect(priceBasket(menu, [{ id: "a", itemCode: "ZZZ", choices: {}, quantity: 1 }]).isValid).toBe(false);
  });
});

describe("allergens and matching", () => {
  it("adds the allergens of chosen options", () => {
    const names = lineAllergens(items.J01, groups, pick(["G_EXTRA", "Fried egg"])).map((a) => a.name);
    expect(names).toEqual(["Eggs", "Milk"]);
  });
  it("treats the same choices in any order as the same line", () => {
    expect(sameChoices(pick(["G_JTOP", "Sweetcorn"], ["G_JTOP", "Red onion"]), pick(["G_JTOP", "Red onion"], ["G_JTOP", "Sweetcorn"]))).toBe(true);
    expect(sameChoices(pick(["G_JTOP", "Sweetcorn"]), {})).toBe(false);
    expect(sameChoices({ G_JTOP: {} }, {})).toBe(true);
  });
});
