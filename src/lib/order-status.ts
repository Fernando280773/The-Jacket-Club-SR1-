export type OrderStatus = "received" | "preparing" | "ready" | "collected" | "out_for_delivery" | "delivered" | "cancelled";
export type OrderType = "collect" | "table" | "delivery";

export type Step = { key: OrderStatus; label: string };

/** The progress steps a customer sees, by order type. */
export function stepsFor(type: OrderType): Step[] {
  if (type === "table") {
    return [
      { key: "received", label: "Received" },
      { key: "preparing", label: "Preparing" },
      { key: "ready", label: "On its way to your table" },
      { key: "collected", label: "Served" },
    ];
  }
  if (type === "delivery") {
    return [
      { key: "received", label: "Received" },
      { key: "preparing", label: "Preparing" },
      { key: "out_for_delivery", label: "Out for delivery" },
      { key: "delivered", label: "Delivered" },
    ];
  }
  return [
    { key: "received", label: "Received" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready to collect" },
    { key: "collected", label: "Collected" },
  ];
}

/** Index of the current step (0-based), or -1 if cancelled. A delivery's "ready" counts as still preparing. */
export function currentStep(type: OrderType, status: OrderStatus): number {
  if (status === "cancelled") return -1;
  const steps = stepsFor(type);
  const i = steps.findIndex((s) => s.key === status);
  if (i >= 0) return i;
  return status === "ready" ? 1 : 0;
}

/** Finished orders stop updating and drop off the menu's "Your order" bar. */
export const isFinished = (status: OrderStatus) => status === "collected" || status === "delivered" || status === "cancelled";

export function headline(type: OrderType, status: OrderStatus): string {
  if (status === "cancelled") return "This order was cancelled";
  const i = currentStep(type, status);
  return stepsFor(type)[i].label;
}
