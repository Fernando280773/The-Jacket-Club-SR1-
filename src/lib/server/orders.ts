import type { OrderStatus, OrderType } from "../order-status";
import { adminClient } from "./admin";

export type OrderLineView = { item_name: string; quantity: number; unit_price_pence: number; line_total_pence: number; order_line_options: { group_name: string; option_name: string; count: number }[] };

export type OrderView = {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  pickup_at: string | null;
  subtotal_pence: number;
  delivery_fee_pence: number;
  total_pence: number;
  created_at: string;
  access_token: string;
  receipt_sent_at: string | null;
  customer_name: string | null;
  dining_tables: { number: number } | null;
  customers: { email: string | null } | null;
  order_lines: OrderLineView[];
};

const SELECT =
  "id, number, type, status, pickup_at, subtotal_pence, delivery_fee_pence, total_pence, created_at, access_token, receipt_sent_at, customer_name, dining_tables(number), customers(email), order_lines(item_name, quantity, unit_price_pence, line_total_pence, order_line_options(group_name, option_name, count))";

export async function orderById(id: string): Promise<OrderView | null> {
  const { data } = await adminClient().from("orders").select(SELECT).eq("id", id).maybeSingle();
  return (data as unknown as OrderView) ?? null;
}

/** Looks up an order by its private tracking token. Returns null for anything that isn't a real token. */
export async function orderByToken(token: string): Promise<OrderView | null> {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  try {
    const { data } = await adminClient().from("orders").select(SELECT).eq("access_token", token).maybeSingle();
    return (data as unknown as OrderView) ?? null;
  } catch {
    return null;
  }
}
