"use client";

import { useEffect, useState } from "react";
import { printerState, type LabelStatus } from "@/lib/labels-status";
import { staffClient } from "@/lib/staff-client";

/** Loads the label printer status for a shop, refreshed every 30 seconds. Null until loaded (or if labels aren't set up). */
export function useLabelStatus(shopId: string): [LabelStatus | null, () => void] {
  const [status, setStatus] = useState<LabelStatus | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let stopped = false;
    const load = () =>
      staffClient()
        .rpc("staff_label_status", { p_shop_id: shopId })
        .then(({ data }) => {
          if (!stopped && data) setStatus(data as LabelStatus);
        });
    load();
    const timer = setInterval(load, 30_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [shopId, tick]);
  return [status, () => setTick((n) => n + 1)];
}

/** Small chip for the kitchen header. Shows nothing while labels are switched off. */
export function PrinterChip({ shopId }: { shopId: string }) {
  const [status] = useLabelStatus(shopId);
  if (!status?.enabled) return null;
  const state = printerState(status, new Date());
  return (
    <span data-testid="printer-chip" data-tone={state.tone} className={`rounded-full px-3 py-1 font-bold ${state.tone === "ok" ? "bg-club-mint text-club-green" : "bg-club-butter text-club-ink"}`}>
      {state.text}
    </span>
  );
}

/** Prints an order's labels again (kitchen or owner). */
export function ReprintLabels({ orderId, className }: { orderId: string; className?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const reprint = async () => {
    setState("busy");
    const { error } = await staffClient().rpc("enqueue_order_labels", { p_order_id: orderId, p_reprint: true });
    setState(error ? "error" : "sent");
    setTimeout(() => setState("idle"), 4000);
  };
  return (
    <button type="button" data-testid="reprint-labels" disabled={state === "busy"} onClick={reprint} className={className ?? "rounded-xl border border-club-line bg-white px-3 py-2 font-bold disabled:opacity-40"}>
      {state === "sent" ? "Sent to printer" : state === "error" ? "Couldn't print" : state === "busy" ? "Sending…" : "Print labels"}
    </button>
  );
}
