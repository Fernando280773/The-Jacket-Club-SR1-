"use client";

import { ReprintLabels } from "@/components/LabelTools";
import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/components/StaffGate";
import { ISSUE_ACTIONS, ISSUE_KINDS, issueActionLabel, issueKindLabel, poundsToPence, STATUS_WORDS, ukDate, type IssueAction, type IssueKind } from "@/lib/history";
import { ukTime } from "@/lib/kitchen";
import { formatPence } from "@/lib/money";
import type { OrderStatus, OrderType } from "@/lib/order-status";
import { staffClient } from "@/lib/staff-client";

type Row = {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  created_at: string;
  pickup_at: string | null;
  total_pence: number;
  is_staff_test: boolean;
  customer_name: string | null;
  phone: string | null;
  table_number: number | null;
  issue_count: number;
};

type Detail = {
  id: string;
  number: number;
  type: OrderType;
  status: OrderStatus;
  created_at: string;
  pickup_at: string | null;
  note: string | null;
  is_staff_test: boolean;
  subtotal_pence: number;
  delivery_fee_pence: number;
  deposit_credit_pence: number;
  total_pence: number;
  owner: boolean;
  customer_name: string | null;
  phone: string | null;
  has_email: boolean;
  table_number: number | null;
  lines: { item_name: string; quantity: number; line_total_pence: number; options: { group_name: string; option_name: string; count: number }[] }[];
  events: { from_status: OrderStatus | null; to_status: OrderStatus; at: string; staff: string | null }[];
  delivery: { address: string; postcode: string; note: string | null; distance_miles: number; driver: string | null; picked_up_at: string | null; delivered_at: string | null } | null;
  issues: { kind: string; item_names: string[]; note: string | null; action: string; refund_pence: number; staff: string | null; at: string }[];
};

const TYPE_WORDS: Record<OrderType, string> = { collect: "Collect", table: "Table", delivery: "Delivery" };

const where = (r: { type: OrderType; table_number: number | null }) => (r.type === "table" && r.table_number ? `Table ${r.table_number}` : TYPE_WORDS[r.type]);

const ukDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short" }).format(new Date(iso));

/** Past orders: find one fast, see exactly what was ordered and who did what, and log a problem. */
export function HistoryTab({ staff }: { staff: Staff }) {
  const isOwner = staff.role === "owner";
  const today = ukDate(new Date());
  const minDay = isOwner ? "2025-01-01" : ukDate(new Date(), 6);
  const [day, setDay] = useState(today);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<OrderType | "">("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, number> | null>(null);

  const load = useCallback(async () => {
    setError("");
    // A search looks across every day you can see; otherwise just the chosen day.
    const searching = search.trim() !== "";
    const { data, error } = await staffClient().rpc("staff_order_history", {
      p_shop_id: staff.shopId,
      p_from: searching ? minDay : day,
      p_to: searching ? today : day,
      p_search: search.trim() || null,
      p_type: type || null,
      p_status: status || null,
    });
    if (error) {
      setError("Couldn't load orders. Check the Wi-Fi and try again.");
      return;
    }
    setRows(((data as { orders: Row[] } | null)?.orders ?? []) as Row[]);
  }, [staff.shopId, day, search, type, status, minDay, today]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const loadSummary = useCallback(async () => {
    if (!isOwner) return;
    const { data } = await staffClient().rpc("order_issue_summary", { p_shop_id: staff.shopId, p_days: 7 });
    setSummary((data as Record<string, number>) ?? {});
  }, [isOwner, staff.shopId]);
  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  if (openId) {
    return (
      <OrderDetail
        orderId={openId}
        onBack={() => {
          setOpenId(null);
          load();
          loadSummary();
        }}
      />
    );
  }

  const summaryTotal = summary ? Object.values(summary).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      {isOwner && summary && (
        <section aria-label="Problems in the last 7 days" data-testid="issue-summary" className="rounded-2xl bg-club-cream p-3 text-sm">
          <p className="font-bold">Problems in the last 7 days: {summaryTotal}</p>
          {summaryTotal > 0 && (
            <p className="mt-1">
              {ISSUE_KINDS.filter((k) => summary[k.id])
                .map((k) => `${k.label} ${summary[k.id]}`)
                .join(" · ")}
            </p>
          )}
        </section>
      )}

      <section aria-label="Find an order" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-xs font-bold sm:col-span-2">
          Search
          <input
            id="history-search"
            data-testid="history-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number, name or last 4 of phone"
            className="rounded-xl border border-club-line bg-white px-3 py-2 text-base font-normal"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-bold">
          Day
          <input
            id="history-day"
            data-testid="history-day"
            type="date"
            value={day}
            min={minDay}
            max={today}
            disabled={search.trim() !== ""}
            onChange={(e) => setDay(e.target.value || today)}
            className="rounded-xl border border-club-line bg-white px-3 py-2 text-base font-normal disabled:opacity-50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-bold">
            Type
            <select id="history-type" value={type} onChange={(e) => setType(e.target.value as OrderType | "")} className="rounded-xl border border-club-line bg-white px-2 py-2 text-base font-normal">
              <option value="">All</option>
              <option value="collect">Collect</option>
              <option value="table">Table</option>
              <option value="delivery">Delivery</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-bold">
            Status
            <select id="history-status" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus | "")} className="rounded-xl border border-club-line bg-white px-2 py-2 text-base font-normal">
              <option value="">All</option>
              <option value="collected">Collected / served</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
              <option value="received">New</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="out_for_delivery">Out for delivery</option>
            </select>
          </label>
        </div>
      </section>
      {!isOwner && <p className="text-xs text-club-muted">Kitchen logins see the last 7 days. The owner can see all orders.</p>}

      {error && (
        <p role="alert" className="font-bold text-red-700">
          {error}
        </p>
      )}
      {rows && rows.length === 0 && <p className="text-club-muted">No orders found.</p>}
      <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
        {(rows ?? []).map((r) => (
          <li key={r.id}>
            <button type="button" data-testid="history-row" data-number={r.number} onClick={() => setOpenId(r.id)} className="grid w-full grid-cols-[4.5rem_1fr_auto] items-center gap-2 px-3 py-3 text-left text-sm">
              <span>
                <span className="block text-base font-bold">#{r.number}</span>
                <span className="text-club-muted">
                  {search.trim() ? `${ukDay(r.created_at)} ` : ""}
                  {ukTime(r.created_at)}
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate font-bold">
                  {where(r)} · {r.customer_name ?? "—"}
                  {r.phone ? ` · ${isOwner ? r.phone : `…${r.phone}`}` : ""}
                </span>
                <span className="flex flex-wrap gap-1 text-club-muted">
                  {STATUS_WORDS[r.status]}
                  {r.issue_count > 0 && (
                    <span data-testid="problem-tag" className="rounded bg-red-600 px-1.5 text-xs font-bold text-white">
                      Problem reported
                    </span>
                  )}
                  {r.is_staff_test && <span className="rounded bg-club-ink px-1.5 text-xs font-bold text-white">STAFF TEST</span>}
                </span>
              </span>
              <span className="font-bold tabular-nums">{formatPence(r.total_pence)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OrderDetail({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [reporting, setReporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await staffClient().rpc("staff_order_detail", { p_order_id: orderId });
    if (error) setError("Couldn't load this order.");
    else setD(data as Detail);
  }, [orderId]);
  useEffect(() => {
    load();
  }, [load]);

  const resend = async () => {
    setSending(true);
    setNotice("");
    const { data } = await staffClient().auth.getSession();
    const res = await fetch("/api/staff/resend-receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ orderId }),
    });
    const j = (await res.json().catch(() => ({ message: "Couldn't send the email." }))) as { message?: string };
    setNotice(j.message ?? "Couldn't send the email.");
    setSending(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <button type="button" data-testid="history-back" onClick={onBack} className="self-start rounded-xl border border-club-line px-3 py-2 font-bold">
        ← Back to orders
      </button>
      {error && <p role="alert">{error}</p>}
      {!d && !error && <p>Loading…</p>}
      {d && (
        <>
          <header data-testid="order-detail" className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-2xl text-club-green">
                #{d.number} · {where(d)}
              </h2>
              <p className="text-sm">
                {ukDay(d.created_at)} {ukTime(d.created_at)}
                {d.pickup_at ? ` · for ${ukTime(d.pickup_at)}` : ""} · {STATUS_WORDS[d.status]}
              </p>
              <p className="text-sm">
                {d.customer_name ?? "—"}
                {d.phone ? (d.owner ? ` · ${d.phone}` : ` · phone ending ${d.phone}`) : ""}
              </p>
            </div>
            {d.is_staff_test && <span className="rounded bg-club-ink px-2 py-1 text-xs font-bold text-white">STAFF TEST</span>}
          </header>

          <section aria-label="What was ordered" className="rounded-2xl bg-white p-3">
            <h3 className="mb-2 font-bold">What was ordered</h3>
            <ul className="flex flex-col gap-2">
              {d.lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    <span className="font-bold">
                      {l.quantity} × {l.item_name}
                    </span>
                    {l.options.length > 0 && (
                      <span className="block text-sm text-club-muted">{l.options.map((o) => (o.count > 1 ? `${o.count}× ${o.option_name}` : o.option_name)).join(", ")}</span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatPence(l.line_total_pence)}</span>
                </li>
              ))}
            </ul>
            {d.note && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-sm font-bold text-red-700">Note: {d.note}</p>}
            <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 border-t border-club-line pt-2 text-sm tabular-nums">
              {d.delivery_fee_pence > 0 && (
                <>
                  <dt>Delivery</dt>
                  <dd>{formatPence(d.delivery_fee_pence)}</dd>
                </>
              )}
              {d.deposit_credit_pence > 0 && (
                <>
                  <dt>Booking deposit taken off</dt>
                  <dd>−{formatPence(d.deposit_credit_pence)}</dd>
                </>
              )}
              <dt className="font-bold">Paid</dt>
              <dd className="font-bold">{formatPence(d.total_pence)}</dd>
            </dl>
          </section>

          {d.delivery && (
            <section aria-label="Delivery" className="rounded-2xl bg-white p-3 text-sm">
              <h3 className="mb-1 font-bold">Delivery</h3>
              <p>{d.delivery.address}</p>
              {d.delivery.note && <p>Note: {d.delivery.note}</p>}
              <p>
                Driver: {d.delivery.driver ?? "not assigned"}
                {d.delivery.picked_up_at ? ` · picked up ${ukTime(d.delivery.picked_up_at)}` : ""}
                {d.delivery.delivered_at ? ` · delivered ${ukTime(d.delivery.delivered_at)}` : ""}
              </p>
            </section>
          )}

          <section aria-label="Timeline" className="rounded-2xl bg-white p-3 text-sm">
            <h3 className="mb-1 font-bold">Timeline</h3>
            {d.events.length === 0 ? (
              <p className="text-club-muted">No timeline for this order (placed before the log started).</p>
            ) : (
              <ol data-testid="order-timeline" className="flex flex-col gap-1">
                {d.events.map((e, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>
                      {STATUS_WORDS[e.to_status]}
                      {e.from_status && isBack(e.from_status, e.to_status) ? " (undo)" : ""}
                    </span>
                    <span className="text-club-muted">
                      {ukTime(e.at)} · {e.staff ?? "System"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section aria-label="Problems" className="flex flex-col gap-2 rounded-2xl bg-white p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">Problems</h3>
              {!reporting && (
                <button type="button" data-testid="report-problem" onClick={() => setReporting(true)} className="rounded-xl bg-red-600 px-3 py-2 font-bold text-white">
                  Report a problem
                </button>
              )}
            </div>
            {d.issues.length === 0 && !reporting && <p className="text-club-muted">None reported.</p>}
            <ul className="flex flex-col gap-2">
              {d.issues.map((x, i) => (
                <li key={i} data-testid="issue" className="rounded-lg bg-red-50 px-2 py-1">
                  <p className="font-bold">
                    {issueKindLabel(x.kind)}
                    {x.item_names.length > 0 ? `: ${x.item_names.join(", ")}` : ""}
                  </p>
                  {x.note && <p>{x.note}</p>}
                  <p className="text-club-muted">
                    {issueActionLabel(x.action)}
                    {x.refund_pence > 0 ? ` ${formatPence(x.refund_pence)}` : ""} · {x.staff ?? "—"} · {ukDay(x.at)} {ukTime(x.at)}
                  </p>
                </li>
              ))}
            </ul>
            {reporting && (
              <ReportForm
                orderId={d.id}
                itemNames={d.lines.map((l) => l.item_name)}
                totalPence={d.total_pence}
                onDone={async (saved) => {
                  setReporting(false);
                  if (saved) {
                    setNotice("Problem saved.");
                    await load();
                  }
                }}
              />
            )}
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" data-testid="resend-receipt" disabled={!d.has_email || sending} onClick={resend} className="rounded-xl border border-club-line bg-white px-3 py-2 font-bold disabled:opacity-40">
              {d.has_email ? "Resend receipt" : "No email on this order"}
            </button>
            <ReprintLabels orderId={orderId} />
            {notice && (
              <p role="status" className="text-sm font-bold">
                {notice}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const ORDER: OrderStatus[] = ["received", "preparing", "ready", "out_for_delivery", "collected", "delivered"];
const isBack = (from: OrderStatus, to: OrderStatus) => ORDER.indexOf(to) < ORDER.indexOf(from) && to !== "cancelled";

function ReportForm({ orderId, itemNames, totalPence, onDone }: { orderId: string; itemNames: string[]; totalPence: number; onDone: (saved: boolean) => void }) {
  const [kind, setKind] = useState<IssueKind>("missing_item");
  const [items, setItems] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [action, setAction] = useState<IssueAction>("remade");
  const [refund, setRefund] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const uniqueItems = [...new Set(itemNames)];

  const save = async () => {
    setError("");
    const refundPence = action === "refunded" ? poundsToPence(refund) : 0;
    if (action === "refunded" && (refundPence === null || refundPence <= 0)) return setError("Enter the refund amount in pounds, like 3.50.");
    if (refundPence !== null && refundPence > totalPence) return setError(`The refund can't be more than the order total (${formatPence(totalPence)}).`);
    if ((kind === "missing_item" || kind === "wrong_item") && items.length === 0) return setError("Tick which item was missing or wrong.");
    setSaving(true);
    const { error } = await staffClient().rpc("report_order_issue", {
      p_order_id: orderId,
      p_kind: kind,
      p_item_names: items,
      p_note: note,
      p_action: action,
      p_refund_pence: refundPence ?? 0,
    });
    setSaving(false);
    if (error) return setError("Couldn't save. Check the Wi-Fi and try again.");
    onDone(true);
  };

  return (
    <div data-testid="report-form" className="flex flex-col gap-3 rounded-xl border-2 border-red-200 p-3">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-bold">What went wrong?</legend>
        {ISSUE_KINDS.map((k) => (
          <label key={k.id} className={`cursor-pointer rounded-full border px-3 py-1.5 font-bold ${kind === k.id ? "border-red-600 bg-red-600 text-white" : "border-club-line"}`}>
            <input type="radio" name="issue-kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} className="sr-only" />
            {k.label}
          </label>
        ))}
      </fieldset>
      {(kind === "missing_item" || kind === "wrong_item") && (
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 font-bold">Which items?</legend>
          {uniqueItems.map((name) => (
            <label key={name} className="flex items-center gap-2">
              <input type="checkbox" data-testid="issue-item" checked={items.includes(name)} onChange={(e) => setItems((s) => (e.target.checked ? [...s, name] : s.filter((x) => x !== name)))} className="h-5 w-5 accent-club-green" />
              {name}
            </label>
          ))}
        </fieldset>
      )}
      <label className="flex flex-col gap-1 font-bold">
        Note (optional)
        <textarea id="issue-note" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-xl border border-club-line px-3 py-2 font-normal" placeholder="What the customer said" />
      </label>
      <fieldset className="flex flex-wrap gap-2">
        <legend className="mb-1 font-bold">What did you do?</legend>
        {ISSUE_ACTIONS.map((a) => (
          <label key={a.id} className={`cursor-pointer rounded-full border px-3 py-1.5 font-bold ${action === a.id ? "border-club-green bg-club-green text-club-paper" : "border-club-line"}`}>
            <input type="radio" name="issue-action" value={a.id} checked={action === a.id} onChange={() => setAction(a.id)} className="sr-only" />
            {a.label}
          </label>
        ))}
      </fieldset>
      {action === "refunded" && (
        <label className="flex flex-col gap-1 font-bold">
          Refund amount (£)
          <input id="issue-refund" data-testid="issue-refund" inputMode="decimal" value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="e.g. 3.50" className="rounded-xl border border-club-line px-3 py-2 font-normal" />
          <span className="text-xs font-normal text-club-muted">Do the refund itself in Stripe → Payments. This only records it.</span>
        </label>
      )}
      {error && (
        <p role="alert" className="font-bold text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => onDone(false)} className="rounded-xl border border-club-line px-3 py-2 font-bold">
          Cancel
        </button>
        <button type="button" data-testid="save-issue" disabled={saving} onClick={save} className="flex-1 rounded-xl bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-50">
          Save problem
        </button>
      </div>
    </div>
  );
}
