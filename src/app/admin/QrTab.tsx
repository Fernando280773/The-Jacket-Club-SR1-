"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { staffClient } from "@/lib/staff-client";

type Card = { title: string; subtitle: string; url: string; svg: string; testId: string };

/** Printable QR cards: one per table (opens that table's ordering) and one for the counter (the menu). */
export function QrTab() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await staffClient().auth.getSession();
      const res = await fetch("/api/staff/tables", { headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` }, cache: "no-store" });
      if (!res.ok) {
        setError("Only the owner can print QR codes. Please sign in again.");
        return;
      }
      const { tables } = (await res.json()) as { tables: { number: number; token: string }[] };
      const origin = window.location.origin;
      const make = async (title: string, subtitle: string, url: string, testId: string): Promise<Card> => ({
        title,
        subtitle,
        url,
        testId,
        svg: await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#1f3d2b", light: "#ffffff" } }),
      });
      setCards([
        await make("Order & pay", "Scan to see the menu and order for collection", `${origin}/`, "qr-counter"),
        ...(await Promise.all(tables.map((t) => make(`Table ${t.number}`, "Scan to order to this table", `${origin}/t/${t.token}`, `qr-table-${t.number}`)))),
      ]);
    })().catch(() => setError("Could not load the tables. Please try again."));
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!cards) return <p>Loading QR codes…</p>;

  const onLiveAddress = !/vercel\.app$|localhost/.test(window.location.hostname);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-sm">
          Codes point to <strong>{window.location.origin}</strong>.
          {!onLiveAddress && " Print them from your own web address once it is connected, so they keep working."}
        </p>
        <button type="button" onClick={() => window.print()} className="rounded-xl bg-club-green px-4 py-2 font-bold text-club-paper">
          Print
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3 print:gap-3">
        {cards.map((c) => (
          <figure key={c.url} data-testid={c.testId} data-url={c.url} className="flex break-inside-avoid flex-col items-center gap-1 rounded-2xl border-2 border-club-green bg-white p-3 text-center">
            <p className="font-display text-xl text-club-green">{c.title}</p>
            <div className="w-full max-w-44" aria-label={`QR code for ${c.title}`} role="img" dangerouslySetInnerHTML={{ __html: c.svg }} />
            <figcaption className="text-xs text-club-ink">{c.subtitle}</figcaption>
            <p className="text-[10px] text-club-muted">The Jacket Club SR1</p>
          </figure>
        ))}
      </div>
    </div>
  );
}
