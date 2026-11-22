"use server";

import type { OrderStatus, OrderType } from "@/lib/order-status";
import { orderByToken } from "@/lib/server/orders";

export type LiveStatus = { found: true; number: number; type: OrderType; status: OrderStatus } | { found: false };

/** Current status for a tracking token. Reveals nothing for a wrong token. */
export async function orderStatus(token: string): Promise<LiveStatus> {
  const o = await orderByToken(String(token));
  return o ? { found: true, number: o.number, type: o.type, status: o.status } : { found: false };
}
