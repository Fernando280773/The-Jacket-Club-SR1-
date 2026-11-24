import type { OrderStatus, OrderType } from "./order-status";

/** Collections and deliveries are packed into a bag, so staff tick each item before marking them Ready. */
export function needsPacking(type: OrderType, status: OrderStatus): boolean {
  return (type === "collect" || type === "delivery") && status === "preparing";
}

/** True once every line on the order is ticked. */
export function allPacked(lineIds: string[], packed: ReadonlySet<string>): boolean {
  return lineIds.length > 0 && lineIds.every((id) => packed.has(id));
}

export const ISSUE_KINDS = [
  { id: "missing_item", label: "Missing item" },
  { id: "wrong_item", label: "Wrong item" },
  { id: "late", label: "Late" },
  { id: "cold", label: "Cold" },
  { id: "other", label: "Other" },
] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number]["id"];

export const ISSUE_ACTIONS = [
  { id: "remade", label: "Remade it" },
  { id: "refunded", label: "Refunded (in Stripe)" },
  { id: "voucher", label: "Gave a voucher" },
  { id: "none", label: "Nothing needed" },
] as const;
export type IssueAction = (typeof ISSUE_ACTIONS)[number]["id"];

export const issueKindLabel = (k: string) => ISSUE_KINDS.find((x) => x.id === k)?.label ?? k;
export const issueActionLabel = (a: string) => ISSUE_ACTIONS.find((x) => x.id === a)?.label ?? a;

export const STATUS_WORDS: Record<OrderStatus, string> = {
  received: "Placed",
  preparing: "Started",
  ready: "Ready",
  collected: "Collected / served",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** A UK calendar date (YYYY-MM-DD) for "today", "yesterday", … */
export function ukDate(d: Date, daysBack = 0): string {
  const shifted = new Date(d.getTime() - daysBack * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(shifted);
}

/** Parses a pounds amount typed by staff ("3", "3.50", "£3.5") into whole pence, or null. */
export function poundsToPence(input: string): number | null {
  const s = input.trim().replace(/^£/, "");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
