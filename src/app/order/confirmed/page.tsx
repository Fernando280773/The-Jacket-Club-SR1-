import type { Metadata } from "next";
import Link from "next/link";
import { formatPence } from "@/lib/money";
import { headers } from "next/headers";
import { RememberOrder } from "@/components/YourOrderBar";
import { fulfilSession } from "@/lib/server/fulfil";
import { orderById } from "@/lib/server/orders";
import { sendReceiptOnce } from "@/lib/server/receipt-email";
import { ClearBasket } from "./ClearBasket";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order confirmed · The Jacket Club SR1" };

const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function OrderConfirmedPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const result = session_id ? await fulfilSession(session_id) : null;

  if (!result || !result.ok) {
    const unpaid = result && !result.ok && result.reason === "unpaid";
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="font-display text-2xl text-club-green">{unpaid ? "Payment not completed" : "Checking your order"}</h1>
        <p>
          {unpaid
            ? "Your payment didn't go through, so no order was placed and you haven't been charged."
            : "If you were charged, your order is safe: we confirm every payment with Stripe. Please show this page to a member of staff."}
        </p>
        {session_id && !unpaid && <p className="text-xs text-club-muted">Reference: {session_id.slice(-12)}</p>}
        <Link href="/basket" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
          Back to basket
        </Link>
      </main>
    );
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  await sendReceiptOnce(result.orderId, origin);
  const order = await orderById(result.orderId);

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <ClearBasket />
      {order && <RememberOrder token={order.access_token} number={order.number} />}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-4xl" aria-hidden="true">
          ✓
        </p>
        <h1 data-testid="order-number" className="font-display text-3xl text-club-green">
          Thank you! Order #{result.orderNumber}
        </h1>
        {order?.type === "collect" && order.pickup_at && <p className="text-lg font-bold">Collect from 12–14 Park Lane at {ukTime(order.pickup_at)}</p>}
        {order?.type === "table" && order.dining_tables && <p className="text-lg font-bold">We&apos;ll bring it to table {order.dining_tables.number}</p>}
        {order?.type === "delivery" && order.deliveries && (
          <p className="text-lg font-bold">
            Delivering to {order.deliveries.address_text}
            {order.pickup_at ? ` at ${ukTime(order.pickup_at)}` : ""}
          </p>
        )}
        <p className="text-sm text-club-muted">
          Payment received.{order?.customers?.email ? ` A receipt is on its way to ${order.customers.email}.` : ""} Show your order number when you collect.
        </p>
        {order && (
          <Link href={`/order/${order.access_token}`} data-testid="track-order" className="mt-2 rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
            Track your order
          </Link>
        )}
      </div>
      {order && (
        <section aria-label="Your order" className="mt-6 rounded-2xl bg-club-cream p-4">
          <ul className="flex flex-col gap-2 text-sm">
            {order.order_lines.map((l, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span>
                  <span className="font-bold">
                    {l.quantity} × {l.item_name}
                  </span>
                  {l.order_line_options.length > 0 && (
                    <span className="block text-club-muted">{l.order_line_options.map((o) => (o.count > 1 ? `${o.option_name} ×${o.count}` : o.option_name)).join(" · ")}</span>
                  )}
                </span>
                <span className="font-bold">{formatPence(l.line_total_pence)}</span>
              </li>
            ))}
          </ul>
          {order.delivery_fee_pence > 0 && (
          <div className="mt-3 flex justify-between border-t border-club-line pt-3 text-sm font-bold">
            <span>Delivery</span>
            <span>{formatPence(order.delivery_fee_pence)}</span>
          </div>
        )}
        {order.deposit_credit_pence > 0 && (
            <div className="mt-3 flex justify-between border-t border-club-line pt-3 text-sm font-bold text-club-green">
              <span>Booking deposit</span>
              <span>−{formatPence(order.deposit_credit_pence)}</span>
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-club-line pt-3 font-bold">
            <span>Paid</span>
            <span>{formatPence(order.total_pence)}</span>
          </div>
        </section>
      )}
      <Link href="/" className="mt-6 block text-center font-bold text-club-green underline">
        Back to the menu
      </Link>
    </main>
  );
}
