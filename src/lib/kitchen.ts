import type { OrderStatus, OrderType } from "./order-status";

/** One order as the kitchen tablet reads it (straight from Supabase, staff access). */
export type KitchenOrder = {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  pickup_at: string | null;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
  note: string | null;
  is_staff_test?: boolean;
  dining_tables: { number: number } | null;
  deliveries: { address_text: string; postcode: string; note: string | null; distance_miles: number; driver_assignments: { driver_id: string }[] } | null;
  order_lines: { id: string; item_name: string; quantity: number; order_line_options: { option_name: string; count: number }[] }[];
};

export const KITCHEN_SELECT =
  "id, number, type, status, pickup_at, created_at, updated_at, customer_name, note, is_staff_test, dining_tables(number), deliveries(address_text, postcode, note, distance_miles, driver_assignments(driver_id)), order_lines(id, item_name, quantity, order_line_options(option_name, count))";

export type Column = "new" | "preparing" | "ready" | "done";

export function columnFor(status: OrderStatus): Column {
  if (status === "received") return "new";
  if (status === "preparing") return "preparing";
  if (status === "ready" || status === "out_for_delivery") return "ready";
  return "done";
}

/** The status a normal tap moves the order to. Matches private.next_status in the database. */
export function nextStatus(type: OrderType, status: OrderStatus): OrderStatus | null {
  if (status === "received") return "preparing";
  if (status === "preparing") return "ready";
  if (status === "ready") return type === "delivery" ? "out_for_delivery" : "collected";
  if (status === "out_for_delivery") return "delivered";
  return null;
}

/** The status Undo moves the order back to. Matches private.previous_status in the database. */
export function previousStatus(type: OrderType, status: OrderStatus): OrderStatus | null {
  if (status === "preparing") return "received";
  if (status === "ready") return "preparing";
  if (status === "collected") return type === "delivery" ? null : "ready";
  if (status === "out_for_delivery") return "ready";
  if (status === "delivered") return "out_for_delivery";
  return null;
}

/** Words on the big button. */
export function actionLabel(type: OrderType, status: OrderStatus): string | null {
  if (status === "received") return "Start preparing";
  if (status === "preparing") return "Ready";
  if (status === "ready") return type === "table" ? "Served" : type === "delivery" ? "Out for delivery" : "Collected";
  if (status === "out_for_delivery") return "Delivered";
  return null;
}

/** How a finished order is described in "Done today". */
export function doneLabel(type: OrderType, status: OrderStatus): string {
  if (status === "cancelled") return "Cancelled";
  if (status === "delivered") return "Delivered";
  return type === "table" ? "Served" : "Collected";
}

export const ukTime = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** "Collect 12:15", "Table 7", "Delivery". */
export function whereLabel(o: Pick<KitchenOrder, "type" | "pickup_at" | "dining_tables">): string {
  if (o.type === "table") return o.dining_tables ? `Table ${o.dining_tables.number}` : "Table";
  if (o.type === "delivery") return o.pickup_at ? `Delivery ${ukTime(o.pickup_at)}` : "Delivery";
  return o.pickup_at ? `Collect ${ukTime(o.pickup_at)}` : "Collect";
}

export const minutesSince = (iso: string, now: Date) => Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));

/** Card colour for how long an order has been waiting: amber from 10 minutes, red from 15. */
export function ageLevel(minutes: number): "ok" | "amber" | "red" {
  if (minutes >= 15) return "red";
  if (minutes >= 10) return "amber";
  return "ok";
}

export const optionsText = (opts: { option_name: string; count: number }[]) =>
  opts.map((o) => (o.count > 1 ? `${o.option_name} ×${o.count}` : o.option_name)).join(" · ");

export const firstName = (name: string | null) => (name ?? "").trim().split(/\s+/)[0] ?? "";

/** Start of today in the UK, as an ISO time (for "Done today"). */
export function ukMidnight(now: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const sinceMidnightMs = ((Number(parts.hour) * 60 + Number(parts.minute)) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnightMs).toISOString();
}

/** Orders in each column. Open orders oldest first (the first in is cooked first); done orders newest first. */
export function boardColumns(orders: KitchenOrder[]): Record<Column, KitchenOrder[]> {
  const cols: Record<Column, KitchenOrder[]> = { new: [], preparing: [], ready: [], done: [] };
  for (const o of orders) cols[columnFor(o.status)].push(o);
  const byNumber = (a: KitchenOrder, b: KitchenOrder) => a.number - b.number;
  cols.new.sort(byNumber);
  cols.preparing.sort(byNumber);
  cols.ready.sort(byNumber);
  cols.done.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return cols;
}
