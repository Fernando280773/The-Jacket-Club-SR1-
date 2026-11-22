"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { OrderStatus } from "@/lib/order-status";
import {
  actionLabel,
  ageLevel,
  boardColumns,
  doneLabel,
  firstName,
  KITCHEN_SELECT,
  minutesSince,
  nextStatus,
  optionsText,
  previousStatus,
  ukMidnight,
  ukTime,
  whereLabel,
  type KitchenOrder,
} from "@/lib/kitchen";
import { staffClient } from "@/lib/staff-client";
import type { Staff } from "@/components/StaffGate";

export type { Staff };


/** Backup check even when live updates are working, so nothing is ever missed. */
export const KITCHEN_POLL_MS = 20_000;
const OPEN = "received,preparing,ready,out_for_delivery";

/** Two short beeps. Browsers only allow sound after a tap, which "Start shift" provides. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  const t = ctx.currentTime;
  for (const start of [0, 0.3]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t + start);
    gain.gain.exponentialRampToValueAtTime(0.6, t + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + start);
    osc.stop(t + start + 0.25);
  }
}

export function KitchenBoard({ staff, signOut }: { staff: Staff; signOut: ReactNode }) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const [loadOk, setLoadOk] = useState(true);
  const [online, setOnline] = useState(true);
  const live = realtimeOk && loadOk && online;
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await staffClient()
      .from("orders")
      .select(KITCHEN_SELECT)
      .eq("shop_id", staff.shopId)
      .or(`status.in.(${OPEN}),created_at.gte.${ukMidnight(new Date())}`)
      .order("number")
      .limit(300);
    if (error) {
      setLoadOk(false);
      return;
    }
    setLoadOk(true);
    const list = (data ?? []) as unknown as KitchenOrder[];
    const fresh = list.filter((o) => o.status === "received" && seen.current && !seen.current.has(o.id));
    if (fresh.length > 0) beep(audio.current);
    seen.current = new Set(list.map((o) => o.id));
    setOrders(list);
    setLoaded(true);
  }, [staff.shopId]);

  // Live updates, with a backup check and a full reload whenever the connection comes back.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 300);
    };
    load();
    const channel = staffClient()
      .channel(`kitchen-${staff.shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${staff.shopId}` }, soon)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeOk(true);
          soon();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setRealtimeOk(false);
        }
      });
    const poll = setInterval(load, KITCHEN_POLL_MS);
    const clock = setInterval(() => setNow(new Date()), 30_000);
    const goOnline = () => {
      setOnline(true);
      soon();
    };
    const goOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      staffClient().removeChannel(channel);
    };
  }, [load, staff.shopId]);

  // Keep the screen on during a shift (the lock drops when the tablet hides the page, so take it again).
  useEffect(() => {
    if (!started) return;
    const take = async () => {
      try {
        const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
        if (document.visibilityState === "visible" && nav.wakeLock) wakeLock.current = await nav.wakeLock.request("screen");
      } catch {
        // not supported or refused: the screen just follows the tablet's own sleep setting
      }
      if (document.visibilityState === "visible") load();
    };
    take();
    document.addEventListener("visibilitychange", take);
    return () => {
      document.removeEventListener("visibilitychange", take);
      wakeLock.current?.release().catch(() => {});
    };
  }, [started, load]);

  const startShift = () => {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audio.current = audio.current ?? new Ctx();
      audio.current.resume();
      beep(audio.current);
    } catch {
      // no sound available on this device
    }
    setStarted(true);
  };

  const move = async (o: KitchenOrder, to: OrderStatus | null) => {
    if (!to) return;
    setBusy(o.id);
    setMessage("");
    // Show the change straight away; the reload below confirms it.
    setOrders((list) => list.map((x) => (x.id === o.id ? { ...x, status: to, updated_at: new Date().toISOString() } : x)));
    const { error } = await staffClient().rpc("set_order_status", { p_order_id: o.id, p_from: o.status, p_to: to });
    if (error) setMessage(`Order #${o.number}: ${error.message.startsWith("order is already") ? "already changed on another screen" : "couldn't update. Check the Wi-Fi."}`);
    await load();
    setBusy(null);
  };

  const cols = boardColumns(orders);

  return (
    <main className="flex min-h-dvh flex-col bg-club-paper">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-club-green px-4 py-3 text-club-paper">
        <h1 className="font-display text-xl">Kitchen</h1>
        <div className="flex items-center gap-3 text-sm">
          <span data-testid="kitchen-connection" className={`rounded-full px-3 py-1 font-bold ${live ? "bg-club-mint text-club-green" : "bg-red-600 text-white"}`}>
            {live ? "Live" : "Reconnecting…"}
          </span>
          <a href="/admin?tab=stock" data-testid="sold-out-link" className="rounded-xl bg-club-butter px-3 py-1.5 font-bold text-club-ink">
            Sold out
          </a>
          <span>{staff.name}</span>
          <span className="text-club-ink">{signOut}</span>
        </div>
      </header>

      {!live && (
        <p role="alert" className="bg-red-600 px-4 py-2 text-center font-bold text-white">
          Connection lost. Reconnecting… New orders will appear as soon as it&apos;s back.
        </p>
      )}
      {!started && (
        <div className="flex flex-col items-center gap-2 bg-club-butter px-4 py-3 text-center">
          <p className="font-bold">Tap Start shift to turn on the new-order sound and keep the screen awake.</p>
          <button type="button" data-testid="start-shift" onClick={startShift} className="rounded-2xl bg-club-green px-6 py-3 text-lg font-bold text-club-paper">
            Start shift
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="bg-club-cream px-4 py-2 text-center font-bold">
          {message}
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-3">
        <BoardColumn title="New" loaded={loaded} testId="col-new" orders={cols.new} now={now} busy={busy} onMove={move} />
        <BoardColumn title="Preparing" loaded={loaded} testId="col-preparing" orders={cols.preparing} now={now} busy={busy} onMove={move} />
        <BoardColumn title="Ready" loaded={loaded} testId="col-ready" orders={cols.ready} now={now} busy={busy} onMove={move} />
      </div>

      <section aria-label="Done today" data-testid="col-done" className="border-t border-club-line px-3 py-3">
        <h2 className="mb-2 font-bold text-club-muted">Done today ({cols.done.length})</h2>
        <ul className="flex flex-col gap-1">
          {cols.done.map((o) => (
            <li key={o.id} data-testid="done-order" className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
              <span>
                <span className="font-bold">#{o.number}</span> · {whereLabel(o)} · {firstName(o.customer_name)} · {doneLabel(o.type, o.status)} {ukTime(o.updated_at)}
              </span>
              {previousStatus(o.type, o.status) && (
                <button type="button" disabled={busy === o.id} onClick={() => move(o, previousStatus(o.type, o.status))} className="rounded-lg border border-club-line px-3 py-1 font-bold disabled:opacity-40">
                  Undo
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function BoardColumn({ title, loaded, testId, orders, now, busy, onMove }: { title: string; loaded: boolean; testId: string; orders: KitchenOrder[]; now: Date; busy: string | null; onMove: (o: KitchenOrder, to: OrderStatus | null) => void }) {
  return (
    <section aria-label={title} data-testid={testId} className="flex flex-col gap-3 rounded-2xl bg-club-cream/50 p-2">
      <h2 className="px-1 font-display text-lg text-club-green">
        {title} <span className="text-club-muted">({orders.length})</span>
      </h2>
      {orders.length === 0 && <p className="px-1 text-sm text-club-muted">{loaded ? "Nothing here" : "Loading…"}</p>}
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} now={now} busy={busy === o.id} onMove={onMove} />
      ))}
    </section>
  );
}

const AGE_STYLE = { ok: "border-club-line", amber: "border-amber-500 ring-2 ring-amber-400", red: "border-red-600 ring-2 ring-red-500" } as const;

function OrderCard({ order: o, now, busy, onMove }: { order: KitchenOrder; now: Date; busy: boolean; onMove: (o: KitchenOrder, to: OrderStatus | null) => void }) {
  const mins = minutesSince(o.created_at, now);
  const level = ageLevel(mins);
  const label = actionLabel(o.type, o.status);
  const back = previousStatus(o.type, o.status);
  return (
    <article data-testid="kitchen-order" data-number={o.number} data-age={level} className={`flex flex-col gap-2 rounded-2xl border-2 bg-white p-3 shadow-sm ${AGE_STYLE[level]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display text-2xl leading-none text-club-green">#{o.number}</p>
          <p className="mt-1 text-xl font-bold">{whereLabel(o)}</p>
          {o.customer_name && <p className="text-sm text-club-muted">{firstName(o.customer_name)}</p>}
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-bold ${level === "red" ? "bg-red-600 text-white" : level === "amber" ? "bg-amber-400" : "bg-club-mint text-club-green"}`}>{mins} min</span>
      </div>
      <ul className="flex flex-col gap-1 border-t border-club-line pt-2">
        {o.order_lines.map((l) => (
          <li key={l.id}>
            <span className="text-lg font-bold">
              {l.quantity} × {l.item_name}
            </span>
            {l.order_line_options.length > 0 && <span className="block text-base">{optionsText(l.order_line_options)}</span>}
          </li>
        ))}
      </ul>
      {o.note && <p className="rounded-lg bg-red-50 px-2 py-1 text-sm font-bold text-red-700">{o.note}</p>}
      <div className="flex gap-2">
        {back && o.status !== "received" && (
          <button type="button" aria-label={`Undo order ${o.number}`} disabled={busy} onClick={() => onMove(o, back)} className="rounded-xl border border-club-line px-3 py-3 font-bold disabled:opacity-40">
            ↶
          </button>
        )}
        {label && (
          <button type="button" data-testid="order-action" disabled={busy} onClick={() => onMove(o, nextStatus(o.type, o.status))} className="flex-1 rounded-xl bg-club-green px-4 py-3 text-lg font-bold text-club-paper disabled:opacity-40">
            {label}
          </button>
        )}
      </div>
    </article>
  );
}
