import type { Allergen, Menu, MenuItem, OptionGroup } from "./menu";

/** Chosen options for one item: group code → option id → how many (1 for pick-one and tick boxes). */
export type Choices = Record<string, Record<string, number>>;

/** What the phone stores and sends. Never a price: prices always come from the menu. */
export type BasketLine = { id: string; itemCode: string; choices: Choices; quantity: number };

export type PricingMenu = { items: Record<string, MenuItem>; groups: Record<string, OptionGroup> };

export const MAX_QUANTITY = 20;

const total = (picked: Record<string, number> | undefined) =>
  Object.values(picked ?? {}).reduce((sum, n) => sum + n, 0);

/** Everything wrong with these choices for this item. An empty list means the line can go in the basket. */
export function checkChoices(item: MenuItem, groups: Record<string, OptionGroup>, choices: Choices): string[] {
  const errors: string[] = [];
  if (!item.isAvailable) errors.push(`${item.name} is sold out`);

  for (const code of Object.keys(choices)) {
    if (!item.groupCodes.includes(code)) errors.push(`${item.name} has no "${code}" choice`);
  }

  for (const code of item.groupCodes) {
    const group = groups[code];
    if (!group) continue;
    const picked = choices[code] ?? {};
    const count = total(picked);

    for (const [optionId, n] of Object.entries(picked)) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) errors.push(`Unknown option in ${group.name}`);
      else if (!option.isAvailable) errors.push(`${option.name} is sold out`);
      if (!Number.isInteger(n) || n < 1) errors.push(`Bad amount in ${group.name}`);
      if (group.control !== "counter" && n !== 1) errors.push(`${group.name}: pick each option once`);
    }

    if (count < group.min) {
      const what = /^choose /i.test(group.name) ? group.name : `Choose ${group.name.toLowerCase()}`;
      errors.push(group.min === 1 ? what : `Choose at least ${group.min} in ${group.name}`);
    }
    if (count > group.max) errors.push(`${group.name}: up to ${group.max}`);
  }
  return errors;
}

/** Price of one of this item with these choices, in pence. */
export function unitPricePence(item: MenuItem, groups: Record<string, OptionGroup>, choices: Choices): number {
  let pence = item.pricePence;
  for (const [code, picked] of Object.entries(choices)) {
    const group = groups[code];
    if (!group) continue;
    for (const [optionId, n] of Object.entries(picked)) {
      const option = group.options.find((o) => o.id === optionId);
      if (option) pence += option.priceChangePence * n;
    }
  }
  return pence;
}

/** Item allergens plus those of every chosen option, in the standard order. */
export function lineAllergens(item: MenuItem, groups: Record<string, OptionGroup>, choices: Choices): Allergen[] {
  const byId = new Map(item.allergens.map((a) => [a.id, a]));
  for (const [code, picked] of Object.entries(choices)) {
    for (const optionId of Object.keys(picked)) {
      groups[code]?.options.find((o) => o.id === optionId)?.allergens.forEach((a) => byId.set(a.id, a));
    }
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

/** "Cheese · Can + fries · Garlic mayo ×2" for showing a line. */
export function describeChoices(item: MenuItem, groups: Record<string, OptionGroup>, choices: Choices): string {
  const parts: string[] = [];
  for (const code of item.groupCodes) {
    const group = groups[code];
    for (const option of group?.options ?? []) {
      const n = choices[code]?.[option.id];
      if (n) parts.push(n > 1 ? `${option.name} ×${n}` : option.name);
    }
  }
  return parts.join(" · ");
}

export type PricedLine = {
  id: string;
  itemCode: string;
  name: string;
  details: string;
  quantity: number;
  unitPricePence: number;
  lineTotalPence: number;
  errors: string[];
};

export type PricedBasket = { lines: PricedLine[]; itemCount: number; subtotalPence: number; isValid: boolean };

/**
 * Works out the basket from the menu alone. Any price or name sent from the phone is ignored:
 * only the item code, chosen option ids and quantity are read.
 */
export function priceBasket(menu: PricingMenu, lines: BasketLine[]): PricedBasket {
  const priced: PricedLine[] = lines.map((line) => {
    const item = menu.items[line.itemCode];
    if (!item) {
      return { id: line.id, itemCode: line.itemCode, name: "Item no longer on the menu", details: "", quantity: 0, unitPricePence: 0, lineTotalPence: 0, errors: ["No longer on the menu"] };
    }
    const errors = checkChoices(item, menu.groups, line.choices);
    const quantity = Number.isInteger(line.quantity) ? line.quantity : 0;
    if (quantity < 1 || quantity > MAX_QUANTITY) errors.push(`Quantity must be 1 to ${MAX_QUANTITY}`);
    const unit = unitPricePence(item, menu.groups, line.choices);
    return {
      id: line.id,
      itemCode: item.code,
      name: item.name,
      details: describeChoices(item, menu.groups, line.choices),
      quantity,
      unitPricePence: unit,
      lineTotalPence: unit * quantity,
      errors,
    };
  });
  return {
    lines: priced,
    itemCount: priced.reduce((n, l) => n + l.quantity, 0),
    subtotalPence: priced.reduce((n, l) => n + l.lineTotalPence, 0),
    isValid: priced.every((l) => l.errors.length === 0),
  };
}

/** Reads basket lines from untrusted input (the browser), keeping only the fields we use. */
export function parseLines(input: unknown): BasketLine[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 50).flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    if (typeof r.itemCode !== "string" || typeof r.id !== "string") return [];
    const choices: Choices = {};
    if (r.choices && typeof r.choices === "object") {
      for (const [code, picked] of Object.entries(r.choices as Record<string, unknown>)) {
        if (!picked || typeof picked !== "object") continue;
        choices[code] = {};
        for (const [optionId, n] of Object.entries(picked as Record<string, unknown>)) {
          if (typeof n === "number") choices[code][optionId] = n;
        }
      }
    }
    return [{ id: r.id, itemCode: r.itemCode, choices, quantity: typeof r.quantity === "number" ? r.quantity : 0 }];
  });
}

/** Two lines are the same if they are the same item with exactly the same choices. */
export function sameChoices(a: Choices, b: Choices): boolean {
  const norm = (c: Choices) =>
    JSON.stringify(
      Object.keys(c)
        .filter((k) => total(c[k]) > 0)
        .sort()
        .map((k) => [k, Object.keys(c[k]).filter((o) => c[k][o] > 0).sort().map((o) => [o, c[k][o]])]),
    );
  return norm(a) === norm(b);
}

/** The lookup tables pricing needs, built from the full menu. */
export function pricingMenuFrom(menu: Pick<Menu, "categories" | "groups">): PricingMenu {
  const items: Record<string, MenuItem> = {};
  for (const c of menu.categories) for (const i of c.items) items[i.code] = i;
  return { items, groups: menu.groups };
}
