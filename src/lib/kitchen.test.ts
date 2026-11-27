import { describe, expect, it } from "vitest";
import { actionLabel, ageLevel, driverStep, boardColumns, columnFor, minutesSince, nextStatus, previousStatus, ukMidnight, whereLabel, type KitchenOrder } from "./kitchen";

const order = (n: number, status: KitchenOrder["status"], extra: Partial<KitchenOrder> = {}): KitchenOrder => ({
  id: `o${n}`,
  number: n,
  type: "collect",
  status,
  pickup_at: null,
  created_at: "2026-11-22T12:00:00Z",
  updated_at: `2026-11-22T12:${String(n % 60).padStart(2, "0")}:00Z`,
  customer_name: "Sam Smith",
  note: null,
  dining_tables: null,
  deliveries: null,
  order_lines: [],
  ...extra,
});

describe("status moves", () => {
  it("collection goes Received → Preparing → Ready → Collected, and no further", () => {
    expect(nextStatus("collect", "received")).toBe("preparing");
    expect(nextStatus("collect", "preparing")).toBe("ready");
    expect(nextStatus("collect", "ready")).toBe("collected");
    expect(nextStatus("collect", "collected")).toBeNull();
    expect(nextStatus("collect", "cancelled")).toBeNull();
  });
  it("undo goes back exactly one step", () => {
    expect(previousStatus("collect", "collected")).toBe("ready");
    expect(previousStatus("table", "ready")).toBe("preparing");
    expect(previousStatus("collect", "preparing")).toBe("received");
    expect(previousStatus("collect", "received")).toBeNull();
    expect(previousStatus("collect", "cancelled")).toBeNull();
  });
  it("delivery goes out for delivery instead of collected", () => {
    expect(nextStatus("delivery", "ready")).toBe("out_for_delivery");
    expect(nextStatus("delivery", "out_for_delivery")).toBe("delivered");
    expect(previousStatus("delivery", "collected")).toBeNull();
  });
  it("picked up and delivered are the driver's steps; the kitchen only gets a backup", () => {
    expect(driverStep("delivery", "ready", true)).toEqual({ waiting: "Waiting for the driver to pick up", backup: "Driver can't tap? Send out" });
    expect(driverStep("delivery", "ready", false)?.waiting).toBe("Choose a driver");
    expect(driverStep("delivery", "out_for_delivery", true)?.waiting).toBe("With the driver");
    expect(driverStep("delivery", "preparing", true)).toBeNull();
    expect(driverStep("collect", "ready", false)).toBeNull();
    expect(driverStep("table", "ready", false)).toBeNull();
  });
  it("button words fit the order type", () => {
    expect(actionLabel("collect", "received")).toBe("Start preparing");
    expect(actionLabel("collect", "ready")).toBe("Collected");
    expect(actionLabel("table", "ready")).toBe("Served");
    expect(actionLabel("collect", "collected")).toBeNull();
  });
});

describe("board", () => {
  it("puts orders in the right column, oldest number first, done newest first", () => {
    const cols = boardColumns([order(1005, "received"), order(1003, "received"), order(1004, "preparing"), order(1001, "collected"), order(1002, "collected"), order(1006, "ready"), order(1007, "cancelled")]);
    expect(cols.new.map((o) => o.number)).toEqual([1003, 1005]);
    expect(cols.preparing.map((o) => o.number)).toEqual([1004]);
    expect(cols.ready.map((o) => o.number)).toEqual([1006]);
    expect(cols.done.map((o) => o.number)).toEqual([1007, 1002, 1001]);
    expect(columnFor("out_for_delivery")).toBe("ready");
  });
  it("shows where the order goes", () => {
    expect(whereLabel({ type: "table", pickup_at: null, dining_tables: { number: 7 } })).toBe("Table 7");
    expect(whereLabel({ type: "collect", pickup_at: "2026-11-22T12:15:00Z", dining_tables: null })).toBe("Collect 12:15");
    expect(whereLabel({ type: "collect", pickup_at: "2026-07-01T12:15:00Z", dining_tables: null })).toBe("Collect 13:15");
    expect(whereLabel({ type: "delivery", pickup_at: "2026-11-22T18:45:00Z", dining_tables: null })).toBe("Delivery 18:45");
  });
  it("turns amber at 10 minutes and red at 15", () => {
    const now = new Date("2026-11-22T12:20:00Z");
    expect(minutesSince("2026-11-22T12:11:00Z", now)).toBe(9);
    expect(ageLevel(9)).toBe("ok");
    expect(ageLevel(10)).toBe("amber");
    expect(ageLevel(14)).toBe("amber");
    expect(ageLevel(15)).toBe("red");
  });
  it("finds UK midnight in winter and summer", () => {
    expect(ukMidnight(new Date("2026-11-22T19:30:00Z"))).toBe("2026-11-22T00:00:00.000Z");
    expect(ukMidnight(new Date("2026-07-01T00:30:00Z"))).toBe("2026-06-30T23:00:00.000Z");
  });
});
