"use client";

import { useEffect, useState } from "react";
import { currentStep, headline, isFinished, stepsFor, type OrderStatus, type OrderType } from "@/lib/order-status";
import { orderStatus } from "@/app/order/actions";

export const POLL_MS = 5000;

/** Progress bar that checks the order every few seconds until it is collected, served or cancelled. */
export function OrderProgress({ token, type, initialStatus }: { token: string; type: OrderType; initialStatus: OrderStatus }) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);

  useEffect(() => {
    if (isFinished(status)) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await orderStatus(token);
        if (!stopped && r.found) setStatus(r.status);
      } catch {
        // offline for a moment: try again next tick
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, status]);

  const steps = stepsFor(type);
  const at = currentStep(type, status);

  return (
    <section aria-label="Order progress" className="flex flex-col gap-4">
      <p data-testid="status-headline" role="status" aria-live="polite" className={`text-center font-display text-2xl ${status === "cancelled" ? "text-red-700" : "text-club-green"}`}>
        {headline(type, status)}
      </p>
      {status !== "cancelled" && (
        <ol className="grid grid-cols-4 gap-2">
          {steps.map((s, i) => (
            <li key={s.key} data-testid="status-step" data-done={i <= at} className="flex flex-col items-center gap-1 text-center text-xs font-bold">
              <span className={`h-2 w-full rounded-full ${i <= at ? "bg-club-green" : "bg-club-line"}`} aria-hidden="true" />
              <span className={i <= at ? "text-club-green" : "text-club-muted"}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
