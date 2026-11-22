import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { buildMenuSql, MIGRATION_PATH } from "../../scripts/build-menu-migration.mjs";

type MenuJson = {
  categories: string[];
  featured: string[];
  items: { code: string; category: string; name: string; price_pence: number; option_groups: string[]; allergens: string[] }[];
  option_groups: { code: string; required: boolean; min: number; max: number }[];
  options: { group: string; name: string; price_change_pence: number; allergens: string[] }[];
};

const menu: MenuJson = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/menu.json"), "utf8"));
const UK_14 = ["Celery", "Gluten", "Crustaceans", "Eggs", "Fish", "Lupin", "Milk", "Molluscs", "Mustard", "Tree nuts", "Peanuts", "Sesame", "Soya", "Sulphites"];

describe("menu data (snapshot of the Menu Sheet)", () => {
  it("has all 52 items in 10 categories, 22 option groups and 80 options", () => {
    expect(menu.items).toHaveLength(52);
    expect(menu.categories).toHaveLength(10);
    expect(menu.option_groups).toHaveLength(22);
    expect(menu.options).toHaveLength(80);
  });

  it("has unique item codes and whole-pence prices", () => {
    expect(new Set(menu.items.map((i) => i.code)).size).toBe(menu.items.length);
    for (const i of menu.items) expect(Number.isInteger(i.price_pence) && i.price_pence > 0).toBe(true);
    for (const o of menu.options) expect(Number.isInteger(o.price_change_pence) && o.price_change_pence >= 0).toBe(true);
  });

  it("only uses known categories, option groups and the 14 UK allergens", () => {
    const groups = new Set(menu.option_groups.map((g) => g.code));
    for (const i of menu.items) {
      expect(menu.categories).toContain(i.category);
      for (const g of i.option_groups) expect(groups).toContain(g);
      for (const a of i.allergens) expect(UK_14).toContain(a);
    }
    for (const o of menu.options) {
      expect(groups).toContain(o.group);
      for (const a of o.allergens) expect(UK_14).toContain(a);
    }
  });

  it("gives every option group at least as many options as it allows, with valid rules", () => {
    for (const g of menu.option_groups) {
      const count = menu.options.filter((o) => o.group === g.code).length;
      expect(count, g.code).toBeGreaterThan(0);
      expect(g.required ? g.min >= 1 : g.min === 0, g.code).toBe(true);
      expect(g.min <= g.max, g.code).toBe(true);
    }
  });

  it("pins the four Club favourites Antony confirmed", () => {
    const names = menu.featured.map((c) => menu.items.find((i) => i.code === c)?.name);
    expect(names).toEqual(["The Classic", "Beef Chilli & Cheese", "Chicken Tikka", "Double Smash Cheeseburger"]);
  });

  it("matches the committed menu migration (regenerate with node scripts/build-menu-migration.mjs)", () => {
    expect(readFileSync(MIGRATION_PATH, "utf8")).toBe(buildMenuSql(menu));
  });
});
