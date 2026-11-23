"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StaffGate, type Staff } from "@/components/StaffGate";
import { navigateUrl } from "@/lib/delivery";
import { optionsText, ukMidnight, ukTime } from "@/lib/kitchen";
import type { OrderStatus } from "@/lib/order-status";
import { staffClient } from "@/lib/staff-client";

type DriverOrder = {
  id: string;
  number: number;
  status: OrderStatus;
  pickup_at: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  updated_at: string;
  deliveries: { address_text: string; postcode: string; note: string | null; latitude: number | null; longitude: number | null; distance_miles: number } | null;
  order_lines: { id: string; item_name: string; quantity: number; order_line_options: { option_name: string; count: number }[] }[];
};

const SELECT =
  "id, number, status, pickup_at, customer_name, customer_phone, updated_at, deliveries(address_text, postcode, note, latitude, longitude, distance_miles), order_lines(id, item_name, quantity, order_line_options(option_name, count))";

/** Driver's phone: only the deliveries given to this driver (the database enforces that). */
export function DriverApp() {
  return (
    <StaffGate title="Driver sign in" roles={["driver"]}>
      {(staff, signOut) => <DriverBoard staff={staff} signOut={signOut} />}
    </StaffGate>
  );
}

function DriverBoard({ staff, signOut }: { staff: Staff; signOut: ReactNode }) {
  const [orders, setOrders] = useState<DriverOrder[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await staffClient()
      .from("orders")
      .select(SELECT)
      .eq("type", "delivery")
      .or(`status.in.(received,preparing,ready,out_for_delivery),updated_at.gte.${ukMidnight(new Date())}`)
      .order("pickup_at");
    if (error) setMessage("Couldn't load deliveries. Check your signal.");
    else setOrders((data ?? []) as unknown as DriverOrder[]);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 20_000);
    return () => clearInterval(t);
  }, [load]);

  const go = async (o: DriverOrder, to: OrderStatus) => {
    setBusy(o.id);
    const { error } = await staffClient().rpc("driver_set_status", { p_order_id: o.id, p_to: to });
    setMessage(error ? `Order #${o.number}: ${/order is/.test(error.message) ? "the kitchen hasn't marked it ready yet." : "couldn't update. Try again."}` : to === "delivered" ? `Order #${o.number} delivered. Thanks!` : `Order #${o.number} is out for delivery.`);
    await load();
    setBusy(null);
  };

  const active = (orders ?? []).filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const done = (orders ?? []).filter((o) => o.status === "delivered");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-center justify-between gap-3 bg-club-green px-4 py-3 text-club-paper">
        <h1 className="font-display text-xl">Deliveries</h1>
        <div className="flex items-center gap-2 text-sm">
          <span>{staff.name}</span>
          {signOut}
        </div>
      </header>
      {message && (
        <p role="status" className="bg-club-cream px-4 py-2 text-center font-bold">
          {message}
        </p>
      )}
      <div className="flex flex-col gap-3 p-3">
        {orders === null && <p>Loading…</p>}
        {orders && active.length === 0 && <p className="py-8 text-center text-club-muted">No deliveries for you right now.</p>}
        {active.map((o) => (
          <article key={o.id} data-testid="driver-order" data-number={o.number} className="flex flex-col gap-3 rounded-2xl border-2 border-club-line bg-white p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-2xl text-club-green">#{o.number}</p>
              <p className="font-bold">{o.pickup_at ? `Deliver by ${ukTime(o.pickup_at)}` : ""}</p>
            </div>
            <div>
              <p className="text-lg font-bold">{o.deliveries?.address_text}</p>
              {o.deliveries?.note && <p className="rounded-lg bg-club-butter/40 px-2 py-1 text-sm font-bold">{o.deliveries.note}</p>}
              <p className="text-sm text-club-muted">
                {o.customer_name} · {o.deliveries ? `${Number(o.deliveries.distance_miles).toFixed(1)} mi` : ""}
              </p>
            </div>
            <ul className="text-sm">
              {o.order_lines.map((l) => (
                <li key={l.id}>
                  <span className="font-bold">
                    {l.quantity} × {l.item_name}
                  </span>
                  {l.order_line_options.length > 0 && <span className="text-club-muted"> · {optionsText(l.order_line_options)}</span>}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 gap-2">
              {o.deliveries && (
                <a href={navigateUrl(o.deliveries)} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-club-cream px-3 py-3 text-center font-bold">
                  Navigate
                </a>
              )}
              {o.customer_phone && (
                <a href={`tel:${o.customer_phone}`} className="rounded-xl bg-club-cream px-3 py-3 text-center font-bold">
                  Call customer
                </a>
              )}
            </div>
            {o.status === "out_for_delivery" ? (
              <button type="button" data-testid="driver-delivered" disabled={busy === o.id} onClick={() => go(o, "delivered")} className="rounded-2xl bg-club-green px-4 py-4 text-lg font-bold text-club-paper disabled:opacity-50">
                Delivered
              </button>
            ) : (
              <button
                type="button"
                data-testid="driver-picked-up"
                disabled={busy === o.id || o.status !== "ready"}
                onClick={() => go(o, "out_for_delivery")}
                className="rounded-2xl bg-club-green px-4 py-4 text-lg font-bold text-club-paper disabled:opacity-40"
              >
                {o.status === "ready" ? "Picked up" : "Waiting for the kitchen…"}
              </button>
            )}
          </article>
        ))}
        {done.length > 0 && (
          <section aria-label="Delivered today" className="mt-2">
            <h2 className="mb-1 font-bold text-club-muted">Delivered today ({done.length})</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {done.map((o) => (
                <li key={o.id} className="rounded-xl bg-white px-3 py-2">
                  #{o.number} · {o.deliveries?.address_text} · {ukTime(o.updated_at)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
