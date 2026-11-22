import { describe, expect, it } from "vitest";
import { currentStep, headline, isFinished, stepsFor } from "./order-status";

describe("order progress", () => {
  it("collection goes Received → Preparing → Ready to collect → Collected", () => {
    expect(stepsFor("collect").map((s) => s.label)).toEqual(["Received", "Preparing", "Ready to collect", "Collected"]);
    expect(currentStep("collect", "preparing")).toBe(1);
    expect(headline("collect", "ready")).toBe("Ready to collect");
  });
  it("table orders say On its way to your table, then Served", () => {
    expect(headline("table", "ready")).toBe("On its way to your table");
    expect(headline("table", "collected")).toBe("Served");
  });
  it("cancelled orders show no step and are finished", () => {
    expect(currentStep("collect", "cancelled")).toBe(-1);
    expect(headline("collect", "cancelled")).toBe("This order was cancelled");
    expect(isFinished("cancelled")).toBe(true);
  });
  it("only collected, delivered and cancelled are finished", () => {
    expect(["received", "preparing", "ready"].some((s) => isFinished(s as never))).toBe(false);
    expect(isFinished("collected")).toBe(true);
  });
});
