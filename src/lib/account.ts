import type { Menu, MenuItem } from "./menu";
import type { OrderStatus, OrderType } from "./order-status";
import { checkChoices, type Choices, type PricingMenu } from "./pricing";

/** What customer_account() returns. */
export type Account = {
  name: string;
  phone: string;
  email: string;
  marketing: boolean;
  addresses: SavedAddress[];
};
export type SavedAddress = { id: string; address: string; postcode: string };

export type PastOption = { option_id: string | null; group_code: string | null; option_name: string; count: number };
export type PastLine = { item_code: string | null; item_name: string; quantity: number; line_total_pence: number; options: PastOption[] };
export type PastOrder = {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  created_at: string;
  pickup_at: string | null;
  total_pence: number;
  access_token: string;
  lines: PastLine[];
};

const FINISHED: OrderStatus[] = ["collected", "delivered", "cancelled"];

/** Orders still on their way (shown at the top of the account page with a Track link). */
export const currentOrders = (orders: PastOrder[]) => orders.filter((o) => !FINISHED.includes(o.status));

export type ReorderLine = { itemCode: string; choices: Choices; quantity: number };

/**
 * Rebuilds a past order as basket lines. Anything that is sold out, no longer on the menu, or whose
 * choices no longer fit the item is left out and named in `skipped`. Prices always come from today's menu.
 */
export function reorderLines(order: Pick<PastOrder, "lines">, menu: PricingMenu): { lines: ReorderLine[]; skipped: string[] } {
  const lines: ReorderLine[] = [];
  const skipped: string[] = [];
  for (const line of order.lines) {
    const item = line.item_code ? menu.items[line.item_code] : undefined;
    if (!item) {
      skipped.push(line.item_name);
      continue;
    }
    const choices: Choices = {};
    let lost = false;
    for (const o of line.options) {
      if (!o.option_id || !o.group_code) {
        lost = true;
        break;
      }
      choices[o.group_code] = { ...(choices[o.group_code] ?? {}), [o.option_id]: o.count };
    }
    if (lost || checkChoices(item, menu.groups, choices).length > 0) {
      skipped.push(line.item_name);
      continue;
    }
    lines.push({ itemCode: item.code, choices, quantity: line.quantity });
  }
  return { lines, skipped };
}

export type Suggestions = {
  /** The item they order most (in at least two orders). */
  usual: { item: MenuItem; times: number } | null;
  /** Their most recent order that can still be ordered again. */
  last: PastOrder | null;
  /** Popular items they haven't tried yet (breakfast first in the morning). */
  tryNew: MenuItem[];
};

const isMorning = (now: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now)) < 11;

/**
 * Simple, explainable suggestions from the customer's own orders. Sold-out items are never suggested.
 * `popular` is item codes, most ordered first (from popular_items()).
 */
export function suggestions(
  orders: PastOrder[],
  menu: Pick<Menu, "categories" | "groups">,
  pricing: PricingMenu,
  popular: string[],
  now: Date,
): Suggestions {
  const available = (code: string | null | undefined) => (code && pricing.items[code]?.isAvailable ? pricing.items[code] : null);

  // Usual: the item found in the most orders.
  const inOrders = new Map<string, number>();
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    for (const code of new Set(o.lines.map((l) => l.item_code).filter((c): c is string => !!c))) {
      inOrders.set(code, (inOrders.get(code) ?? 0) + 1);
    }
  }
  let usual: Suggestions["usual"] = null;
  for (const [code, times] of [...inOrders.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    const item = available(code);
    if (item && times >= 2) {
      usual = { item, times };
      break;
    }
  }

  const last = orders.find((o) => o.status !== "cancelled" && reorderLines(o, pricing).lines.length > 0) ?? null;

  // Try something new: popular first, then the menu's featured order; breakfast first before 11am.
  const tried = new Set(inOrders.keys());
  const breakfast = new Set(menu.categories.filter((c) => /breakfast/i.test(c.name)).flatMap((c) => c.items.map((i) => i.code)));
  const pool = [...popular, ...menu.categories.flatMap((c) => c.items.filter((i) => i.isFeatured).map((i) => i.code))];
  let candidates = [...new Set(pool)].filter((code) => !tried.has(code) && available(code));
  if (isMorning(now)) {
    const morning = menu.categories.flatMap((c) => c.items).filter((i) => breakfast.has(i.code) && !tried.has(i.code) && i.isAvailable);
    candidates = [...new Set([...morning.map((i) => i.code), ...candidates])];
  } else {
    candidates = candidates.filter((code) => !breakfast.has(code)).concat(candidates.filter((code) => breakfast.has(code)));
  }
  const tryNew = candidates.slice(0, 3).map((code) => pricing.items[code]);

  return { usual, last, tryNew };
}

/** "Mon 23 Nov" in UK time. */
export const shortDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" }).format(new Date(iso));

/** "2 × Classic, Fries" style summary of an order's items. */
export const orderSummary = (o: Pick<PastOrder, "lines">) =>
  o.lines.map((l) => (l.quantity > 1 ? `${l.quantity} × ${l.item_name}` : l.item_name)).join(", ");
