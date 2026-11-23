"use client";

import { useState } from "react";
import { formatPence } from "@/lib/money";
import { cancelMyBooking } from "@/app/book/actions";

export function CancelBooking({ token, refundable, depositText, noticeHours }: { token: string; refundable: boolean; depositText: string; noticeHours: number }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    const r = await cancelMyBooking(token).catch(() => ({ ok: false as const, error: "Couldn't cancel right now. Please try again." }));
    setBusy(false);
    setResult(r.ok ? (r.refundedPence > 0 ? `Cancelled. ${formatPence(r.refundedPence)} is on its way back to your card (usually 5–10 days).` : "Cancelled. The deposit was kept as it was less than the notice time.") : r.error);
    if (r.ok) setTimeout(() => window.location.reload(), 2500);
  };

  if (result) {
    return (
      <p role="status" data-testid="cancel-result" className="rounded-xl bg-club-cream px-4 py-3 text-center font-bold">
        {result}
      </p>
    );
  }

  return (
    <section aria-label="Cancel booking" className="flex flex-col gap-3 rounded-2xl border border-club-line p-4">
      <p data-testid="refund-rule" className="text-sm">
        {refundable
          ? `Cancel now and your ${depositText} deposit is refunded in full.`
          : `It's less than ${noticeHours} hours to your booking, so if you cancel now there's no refund.`}
      </p>
      {!asking ? (
        <button type="button" data-testid="cancel-booking" onClick={() => setAsking(true)} className="rounded-2xl border border-red-700 px-5 py-3 font-bold text-red-700">
          Cancel booking
        </button>
      ) : (
        <div className="flex gap-2">
          <button type="button" data-testid="confirm-cancel" disabled={busy} onClick={cancel} className="flex-1 rounded-2xl bg-red-700 px-5 py-3 font-bold text-white disabled:opacity-50">
            {busy ? "Cancelling…" : refundable ? "Yes, cancel and refund" : "Yes, cancel (no refund)"}
          </button>
          <button type="button" onClick={() => setAsking(false)} className="rounded-2xl border border-club-line px-5 py-3 font-bold">
            Keep it
          </button>
        </div>
      )}
    </section>
  );
}
