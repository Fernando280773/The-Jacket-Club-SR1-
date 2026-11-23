"use client";

import { useEffect, useState } from "react";
import { staffClient } from "@/lib/staff-client";

/**
 * Owner-only switch: lets this phone or tablet place real orders on the live site before opening day,
 * for the live payment test and the practice service. Orders are marked STAFF TEST. Lasts about an hour.
 */
export function StaffTestMode() {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/staff/test-mode", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { on: boolean }) => setOn(j.on))
      .catch(() => setOn(false));
  }, []);

  const turnOn = async () => {
    setBusy(true);
    setNotice("");
    const { data } = await staffClient().auth.getSession();
    const token = data.session?.access_token;
    const res = token ? await fetch("/api/staff/test-mode", { method: "POST", headers: { Authorization: `Bearer ${token}` } }) : null;
    setBusy(false);
    if (!res?.ok) {
      setNotice("Only the owner can turn this on. Please sign in again.");
      return;
    }
    setOn(true);
    setNotice("Staff test mode is on in this browser for about an hour.");
  };

  const turnOff = async () => {
    setBusy(true);
    await fetch("/api/staff/test-mode", { method: "DELETE" });
    setBusy(false);
    setOn(false);
    setNotice("Staff test mode is off.");
  };

  return (
    <section aria-label="Staff test mode" className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-club-line p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{on ? "Staff test mode is ON" : "Staff test mode"}</h2>
        {on !== null && (
          <button
            type="button"
            data-testid="toggle-staff-test"
            disabled={busy}
            onClick={on ? turnOff : turnOn}
            className="rounded-xl bg-club-butter px-4 py-2 font-bold text-club-ink disabled:opacity-50"
          >
            {on ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
      <p className="text-sm text-club-muted">
        Before opening day, lets this browser place real orders and bookings on the live site (for the payment test and the practice service). They show as STAFF TEST in the kitchen.
      </p>
      {notice && (
        <p role="status" className="text-sm font-bold">
          {notice}
        </p>
      )}
    </section>
  );
}
