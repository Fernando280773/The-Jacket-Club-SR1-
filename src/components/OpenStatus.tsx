"use client";

import { useEffect, useState } from "react";
import { getOpenStatus, type DayHours, type OpenStatus as Status } from "@/lib/opening";

/** Worked out in the browser every minute, so it is always live even when the menu itself is cached. */
export function OpenStatus({ hours }: { hours: DayHours[] }) {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    const update = () => setStatus(getOpenStatus(hours, new Date()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [hours]);

  return (
    <p
      data-testid="open-status"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
        status?.isOpen ? "bg-club-mint text-club-green" : "bg-club-cream text-club-ink"
      }`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${status?.isOpen ? "bg-club-green-2" : "bg-club-muted"}`} />
      {status ? status.label : "Checking hours…"}
    </p>
  );
}
