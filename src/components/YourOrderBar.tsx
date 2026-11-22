"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { headline, isFinished, type OrderStatus, type OrderType } from "@/lib/order-status";
import { orderStatus } from "@/app/order/actions";

const KEY = "jc-last-order-v1";
type Saved = { token: string; number: number };

function read(): Saved | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    return v && typeof v.token === "string" && typeof v.number === "number" ? v : null;
  } catch {
    return null;
  }
}

/** Remembers the customer's latest order on this phone, for the menu's "Your order" bar. */
export function RememberOrder({ token, number }: Saved) {
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ token, number }));
    } catch {
      // private mode: the bar simply won't show
    }
  }, [token, number]);
  return null;
}

/** "Your order #1003 · Preparing" at the top of the menu until the order is finished. */
export function YourOrderBar() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [live, setLive] = useState<{ type: OrderType; status: OrderStatus } | null>(null);

  useEffect(() => setSaved(read()), []);

  useEffect(() => {
    if (!saved) return;
    let stopped = false;
    const check = async () => {
      try {
        const r = await orderStatus(saved.token);
        if (stopped) return;
        if (!r.found || isFinished(r.status)) {
          setLive(null);
          try {
            window.localStorage.removeItem(KEY);
          } catch {}
          stopped = true;
          return;
        }
        setLive({ type: r.type, status: r.status });
      } catch {}
    };
    check();
    const timer = setInterval(() => !stopped && check(), 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [saved]);

  if (!saved || !live) return null;
  return (
    <Link href={`/order/${saved.token}`} data-testid="your-order-bar" className="-mx-4 flex items-center justify-between bg-club-green px-4 py-2 text-sm font-bold text-club-paper">
      <span>
        Your order #{saved.number} · {headline(live.type, live.status)}
      </span>
      <span aria-hidden="true">Track →</span>
    </Link>
  );
}
