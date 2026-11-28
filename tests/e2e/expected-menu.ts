import { readFileSync } from "node:fs";
import path from "node:path";

export type ExpectedItem = { code: string; name: string; price_pence: number; allergens: string[] };
type MenuJson = { categories: string[]; featured: string[]; items: ExpectedItem[] };
type Change = {
  remove?: string[];
  add?: ExpectedItem[];
  update?: { code: string; name?: string; price_pence?: number; add_allergens?: string[] }[];
};

const read = <T>(file: string): T => JSON.parse(readFileSync(path.resolve(__dirname, "../../data", file), "utf8")) as T;

/**
 * What the live menu should show: the original Menu Sheet snapshot (data/menu.json), the allergen fixes from
 * supplier labels (data/allergen-corrections.json) and the later menu changes (data/menu-changes.json), in that order.
 */
export function expectedMenu(): MenuJson {
  const menu = read<MenuJson>("menu.json");
  const corrections = read<{ corrections: { codes: string[]; add: string[] }[] }>("allergen-corrections.json").corrections;
  let items = menu.items.map((i) => ({
    code: i.code,
    name: i.name,
    price_pence: i.price_pence,
    allergens: [...i.allergens, ...corrections.filter((c) => c.codes.includes(i.code)).flatMap((c) => c.add)],
  }));
  for (const change of read<{ changes: Change[] }>("menu-changes.json").changes) {
    const gone = new Set(change.remove ?? []);
    items = items.filter((i) => !gone.has(i.code));
    for (const u of change.update ?? []) {
      const item = items.find((i) => i.code === u.code);
      if (!item) throw new Error(`menu-changes.json updates ${u.code}, which is not on the menu`);
      if (u.name) item.name = u.name;
      if (u.price_pence !== undefined) item.price_pence = u.price_pence;
      item.allergens.push(...(u.add_allergens ?? []));
    }
    items.push(...(change.add ?? []).map((a) => ({ ...a, allergens: [...a.allergens] })));
  }
  return { ...menu, items: items.map((i) => ({ ...i, allergens: [...new Set(i.allergens)].sort() })) };
}
