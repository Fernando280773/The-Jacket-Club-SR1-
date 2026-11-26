import { describe, expect, it } from "vitest";
import { printerState, type LabelStatus } from "./labels-status";

const now = new Date("2026-12-10T12:00:00Z");
const base: LabelStatus = { enabled: true, types: ["collect", "delivery"], printer_seen_at: "2026-12-10T11:59:55Z", printer_status: "200 OK", waiting: 0, failed_today: 0 };

describe("label printer status", () => {
  it("is fine when the printer asked for work a moment ago", () => {
    expect(printerState(base, now)).toEqual({ tone: "ok", text: "Labels on" });
  });
  it("says so when no printer has ever connected", () => {
    expect(printerState({ ...base, printer_seen_at: null }, now).tone).toBe("off");
  });
  it("warns when the printer has gone quiet, with how many labels are waiting", () => {
    expect(printerState({ ...base, printer_seen_at: "2026-12-10T11:55:00Z", waiting: 3 }, now)).toEqual({ tone: "warn", text: "Label printer offline · 3 waiting" });
  });
  it("shows a printer fault such as paper out", () => {
    expect(printerState({ ...base, printer_status: "410 Paper Empty" }, now)).toEqual({ tone: "warn", text: "Label printer: Paper Empty" });
  });
});
