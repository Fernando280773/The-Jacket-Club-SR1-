"use client";

import { useEffect, useState } from "react";
import { useLabelStatus } from "@/components/LabelTools";
import type { Staff } from "@/components/StaffGate";
import { printerState } from "@/lib/labels-status";
import { staffClient } from "@/lib/staff-client";
import { friendlyError } from "./refresh";

const TYPES = [
  { key: "collect", label: "Collect" },
  { key: "delivery", label: "Delivery" },
  { key: "table", label: "Table" },
] as const;

/** Owner: switch item labels on or off, choose which orders get them, see the printer and a sample label. */
export function LabelSettings({ staff }: { staff: Staff }) {
  const [status, reload] = useLabelStatus(staff.shopId);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    let url: string | null = null;
    (async () => {
      const { data } = await staffClient().auth.getSession();
      const res = await fetch("/api/staff/label-preview", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
      if (!res.ok) return;
      url = URL.createObjectURL(await res.blob());
      setPreview(url);
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

  if (!status) return null;
  const state = printerState(status, new Date());

  const save = async (enabled: boolean, types: string[]) => {
    setSaving(true);
    setNotice("");
    const { error } = await staffClient().rpc("admin_set_labels", { p_shop_id: staff.shopId, p_enabled: enabled, p_types: types });
    setSaving(false);
    if (error) setNotice(friendlyError(error.message));
    else setNotice(enabled ? "Labels are on. They print when an order is paid." : "Labels are off.");
    reload();
  };

  const test = async () => {
    setNotice("");
    const { error } = await staffClient().rpc("staff_print_test_label", { p_shop_id: staff.shopId });
    setNotice(error ? friendlyError(error.message) : "Test label sent. It prints within a few seconds if the printer is connected.");
    reload();
  };

  return (
    <section aria-label="Item labels" data-testid="label-settings" className="flex flex-col gap-3 rounded-2xl bg-club-cream p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{status.enabled ? "Item labels are ON" : "Item labels are OFF"}</h2>
        <button type="button" data-testid="toggle-labels" disabled={saving} onClick={() => save(!status.enabled, status.types)} className={`rounded-xl px-4 py-2 font-bold disabled:opacity-50 ${status.enabled ? "bg-club-ink text-club-paper" : "bg-club-green text-club-paper"}`}>
          {status.enabled ? "Turn off" : "Turn on"}
        </button>
      </div>
      <p className="text-sm">One sticker per item prints when an order is paid: name, order number, time, the item with its extras, and allergens.</p>
      <fieldset className="flex flex-wrap gap-4 text-sm font-bold">
        <legend className="mb-1">Print labels for</legend>
        {TYPES.map((t) => (
          <label key={t.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              data-testid={`label-type-${t.key}`}
              className="h-5 w-5 accent-club-green"
              disabled={saving}
              checked={status.types.includes(t.key)}
              onChange={(e) => save(status.enabled, e.target.checked ? [...status.types, t.key] : status.types.filter((x) => x !== t.key))}
            />
            {t.label}
          </label>
        ))}
      </fieldset>
      <p data-testid="printer-state" className="text-sm font-bold">
        {state.text}
        {status.failed_today > 0 ? ` · ${status.failed_today} label${status.failed_today === 1 ? "" : "s"} didn't print today` : ""}
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <button type="button" data-testid="test-label" onClick={test} className="rounded-xl border border-club-line bg-white px-3 py-2 font-bold">
          Print a test label
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview && <img src={preview} alt="Sample label: 2 of 3, Sam, order 1008, Collect 11:30, Tuna Mayo and Sweetcorn with extras, allergens" width={203} className="rounded border border-club-line bg-white" />}
      </div>
      {notice && (
        <p role="status" className="text-sm font-bold">
          {notice}
        </p>
      )}
    </section>
  );
}
