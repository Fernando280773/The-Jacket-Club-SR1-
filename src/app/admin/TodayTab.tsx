"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/components/StaffGate";
import { todaySummary, type TodayOrder } from "@/lib/admin";
import { ukMidnight, ukTime } from "@/lib/kitchen";
import { formatPence } from "@/lib/money";
import { staffClient } from "@/lib/staff-client";
import { friendlyError, refreshMenu } from "./refresh";

const STATUS_WORDS: Record<string, string> = {
  received: "New",
  preparing: "Preparing",
  ready: "Ready",
  collected: "Done",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const TYPE_WORDS: Record<string, string> = { collect: "Collect", table: "Table", delivery: "Delivery" };

export function TodayTab({ staff }: { staff: Staff }) {
  const [orders, setOrders] = useState<TodayOrder[] | null>(null);
  const [accepting, setAccepting] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const db = staffClient();
    const [o, s] = await Promise.all([
      db.from("orders").select("number, status, type, total_pence, created_at").eq("shop_id", staff.shopId).gte("created_at", ukMidnight(new Date())).order("number", { ascending: false }),
      db.from("shop_settings").select("is_accepting_orders, paused_message").eq("shop_id", staff.shopId).single(),
    ]);
    if (!o.error) setOrders((o.data ?? []) as TodayOrder[]);
    if (!s.error && s.data) {
      setAccepting(s.data.is_accepting_orders);
      setMessage((m) => (m === "" ? (s.data.paused_message ?? "") : m));
    }
  }, [staff.shopId]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const setOrdering = async (next: boolean) => {
    setSaving(true);
    setNotice("");
    const { error } = await staffClient().rpc("admin_set_ordering", { p_shop_id: staff.shopId, p_accepting: next, p_message: message });
    setSaving(false);
    if (error) {
      setNotice(friendlyError(error.message));
      return;
    }
    setAccepting(next);
    if (next) setMessage("");
    setNotice(next ? "Online ordering is on." : "Online ordering is paused. Customers see your message.");
    refreshMenu();
  };

  const summary = todaySummary(orders ?? []);

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Today's numbers" className="grid grid-cols-3 gap-3">
        <Stat label="Orders" value={orders ? String(summary.count) : "…"} testId="stat-orders" />
        <Stat label="Taken" value={orders ? formatPence(summary.takenPence) : "…"} testId="stat-taken" />
        <Stat label="Average" value={orders ? formatPence(summary.averagePence) : "…"} testId="stat-average" />
      </section>

      <section aria-label="Online ordering" className={`flex flex-col gap-3 rounded-2xl p-4 ${accepting === false ? "bg-club-ink text-club-paper" : "bg-club-mint"}`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-bold">{accepting === null ? "Online ordering" : accepting ? "Online ordering is ON" : "Online ordering is PAUSED"}</h2>
          {accepting !== null && (
            <button
              type="button"
              data-testid="toggle-ordering"
              disabled={saving}
              onClick={() => setOrdering(!accepting)}
              className={`rounded-xl px-4 py-2 font-bold disabled:opacity-50 ${accepting ? "bg-club-ink text-club-paper" : "bg-club-butter text-club-ink"}`}
            >
              {accepting ? "Pause ordering" : "Start taking orders"}
            </button>
          )}
        </div>
        {accepting && (
          <label className="flex flex-col gap-1 text-sm font-bold">
            Message for customers while paused (optional)
            <input
              data-testid="paused-message"
              maxLength={120}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. Back at 2pm"
              className="rounded-xl border border-club-line bg-white px-3 py-2 font-normal text-club-ink"
            />
          </label>
        )}
        {accepting === false && message && <p className="text-sm">Customers see: “{message}”</p>}
        {notice && (
          <p role="status" className="text-sm font-bold">
            {notice}
          </p>
        )}
      </section>

      <section aria-label="Today's orders">
        <h2 className="mb-2 font-display text-lg text-club-green">Today&apos;s orders</h2>
        {orders && orders.length === 0 && <p className="text-club-muted">No orders yet today.</p>}
        <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
          {(orders ?? []).map((o) => (
            <li key={o.number} data-testid="today-order" className="grid grid-cols-[4rem_3.5rem_1fr_auto] items-center gap-2 px-3 py-2 text-sm">
              <span className="font-bold">#{o.number}</span>
              <span className="text-club-muted">{ukTime(o.created_at)}</span>
              <span>
                {TYPE_WORDS[o.type] ?? o.type} · {STATUS_WORDS[o.status] ?? o.status}
              </span>
              <span className={`font-bold ${o.status === "cancelled" ? "text-club-muted line-through" : ""}`}>{formatPence(o.total_pence)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-2xl bg-club-cream p-3 text-center">
      <p className="text-xs font-bold uppercase text-club-muted">{label}</p>
      <p data-testid={testId} className="font-display text-2xl text-club-green">
        {value}
      </p>
    </div>
  );
}
