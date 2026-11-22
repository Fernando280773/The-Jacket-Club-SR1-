"use client";

import { useEffect, useState } from "react";
import type { Staff } from "@/components/StaffGate";
import { DAY_NAMES, formToHours, hoursToForm, type DayForm } from "@/lib/admin";
import { staffClient } from "@/lib/staff-client";
import { friendlyError, refreshMenu } from "./refresh";

export function HoursTab({ staff }: { staff: Staff }) {
  const [days, setDays] = useState<DayForm[] | null>(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffClient()
      .from("opening_hours")
      .select("iso_day, opens, closes")
      .eq("shop_id", staff.shopId)
      .then(({ data }) => setDays(hoursToForm(data ?? [])));
  }, [staff.shopId]);

  if (!days) return <p>Loading…</p>;

  const change = (i: number, patch: Partial<DayForm>) => setDays((d) => d!.map((day, j) => (j === i ? { ...day, ...patch } : day)));

  const save = async () => {
    const checked = formToHours(days);
    if (!checked.ok) {
      setNotice(checked.error);
      return;
    }
    setSaving(true);
    const { error } = await staffClient().rpc("admin_set_hours", { p_shop_id: staff.shopId, p_hours: checked.hours });
    setSaving(false);
    if (error) {
      setNotice(friendlyError(error.message));
      return;
    }
    setNotice("Saved. The menu and collection times now use these hours.");
    refreshMenu();
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-club-muted">UK time. Collection slots stop 15 minutes before closing. Untick a day to close all day.</p>
      <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
        {days.map((d, i) => (
          <li key={d.isoDay} data-testid="hours-day" className="flex flex-wrap items-center gap-3 px-3 py-3">
            <label className="flex w-36 items-center gap-2 font-bold">
              <input type="checkbox" checked={d.open} onChange={(e) => change(i, { open: e.target.checked })} className="h-5 w-5 accent-club-green" />
              {DAY_NAMES[i]}
            </label>
            {d.open ? (
              <span className="flex items-center gap-2">
                <input type="time" aria-label={`${DAY_NAMES[i]} opens`} value={d.opens} onChange={(e) => change(i, { opens: e.target.value })} className="rounded-lg border border-club-line px-2 py-1" />
                to
                <input type="time" aria-label={`${DAY_NAMES[i]} closes`} value={d.closes} onChange={(e) => change(i, { closes: e.target.value })} className="rounded-lg border border-club-line px-2 py-1" />
              </span>
            ) : (
              <span className="font-bold text-club-muted">Closed</span>
            )}
          </li>
        ))}
      </ul>
      {notice && (
        <p role="status" className="font-bold">
          {notice}
        </p>
      )}
      <button type="button" data-testid="save-hours" disabled={saving} onClick={save} className="self-start rounded-2xl bg-club-green px-6 py-3 font-bold text-club-paper disabled:opacity-50">
        {saving ? "Saving…" : "Save hours"}
      </button>
    </div>
  );
}
