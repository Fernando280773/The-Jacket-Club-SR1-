import type { Metadata } from "next";
import Link from "next/link";
import { OrderProgress } from "@/components/OrderProgress";
import { RememberOrder } from "@/components/YourOrderBar";
import { formatPence } from "@/lib/money";
import { orderByToken } from "@/lib/server/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your order · The Jacket Club SR1", robots: { index: false } };

const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function OrderStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const order = await orderByToken(token);

  if (!order) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 data-testid="order-not-found" className="font-display text-2xl text-club-green">
          Order not found
        </h1>
        <p>Please check the link in your receipt email, or ask a member of staff.</p>
        <Link href="/" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
          Back to the menu
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
      <RememberOrder token={order.access_token} number={order.number} />
      <div className="text-center">
        <p className="text-sm font-bold text-club-muted">{order.type === "delivery" ? "Your order number" : "Show this number when you collect"}</p>
        <h1 data-testid="tracked-order-number" className="font-display text-5xl text-club-green">
          #{order.number}
        </h1>
        {order.type === "collect" && order.pickup_at && <p className="mt-2 text-lg font-bold">Collect from 12–14 Park Lane at {ukTime(order.pickup_at)}</p>}
        {order.type === "table" && order.dining_tables && <p className="mt-2 text-lg font-bold">Table {order.dining_tables.number}</p>}
        {order.type === "delivery" && order.deliveries && (
          <p className="mt-2 text-lg font-bold">
            Delivering to {order.deliveries.address_text}
            {order.pickup_at ? ` at ${ukTime(order.pickup_at)}` : ""}
          </p>
        )}
      </div>

      <OrderProgress token={order.access_token} type={order.type} initialStatus={order.status} />

      <section aria-label="Your order" className="rounded-2xl bg-club-cream p-4">
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
          <span data-testid="tracked-total">{formatPence(order.total_pence)}</span>
        </div>
      </section>

      <p className="text-center text-xs text-club-muted">This page updates by itself. Questions? Call in or email info@thejacketclubsr1.com</p>
      <Link href="/" className="text-center font-bold text-club-green underline">
        Back to the menu
      </Link>
    </main>
  );
}
