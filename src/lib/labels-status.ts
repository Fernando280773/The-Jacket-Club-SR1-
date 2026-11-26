/** What staff_label_status() returns. */
export type LabelStatus = {
  enabled: boolean;
  types: string[];
  printer_seen_at: string | null;
  printer_status: string | null;
  waiting: number;
  failed_today: number;
};

export type PrinterState = { tone: "ok" | "warn" | "off"; text: string };

/** A printer that hasn't asked for work in 90 seconds counts as offline (it normally asks every few seconds). */
export const PRINTER_QUIET_MS = 90_000;

/** One short line for the kitchen screen: is the label printer there, and is anything stuck? */
export function printerState(s: LabelStatus, now: Date): PrinterState {
  if (!s.printer_seen_at) return { tone: "off", text: "Label printer not connected yet" };
  const quiet = now.getTime() - new Date(s.printer_seen_at).getTime() > PRINTER_QUIET_MS;
  if (quiet) return { tone: "warn", text: s.waiting > 0 ? `Label printer offline · ${s.waiting} waiting` : "Label printer offline" };
  // CloudPRNT sends "200 OK" when ready; anything else is a fault such as paper out or cover open.
  if (s.printer_status && !/^2\d\d/.test(s.printer_status)) return { tone: "warn", text: `Label printer: ${s.printer_status.replace(/^\d+\s*/, "") || "check printer"}` };
  if (s.waiting > 5) return { tone: "warn", text: `Labels: ${s.waiting} waiting` };
  return { tone: "ok", text: "Labels on" };
}
