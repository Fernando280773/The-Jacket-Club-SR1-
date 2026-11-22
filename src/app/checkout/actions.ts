"use server";

import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { checkDetails, normaliseUkMobile, stripeLineItems } from "@/lib/checkout";
import { getMenu } from "@/lib/menu";
import { getOpenStatus } from "@/lib/opening";
import { parseLines, priceBasket, pricingMenuFrom } from "@/lib/pricing";
import { pickupSlots } from "@/lib/slots";
import { adminClient } from "@/lib/server/admin";
import { orderingOpen } from "@/lib/server/ordering";
import { paymentsConfigured, stripe } from "@/lib/server/stripe";
import { tableForToken } from "@/lib/server/tables";

export type StartCheckoutInput = {
  lines: unknown;
  orderType: string;
  tableToken?: string;
  pickupAt?: string;
  name: string;
  phone: string;
  email: string;
};

export type StartCheckoutResult = { ok: true; url: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Re-prices the basket on the server, saves it, and opens a Stripe payment page.
 * Nothing becomes an order until Stripe confirms payment (see fulfilSession).
 */
export async function startCheckout(input: StartCheckoutInput): Promise<StartCheckoutResult> {
  const now = new Date();
  if (!orderingOpen(now)) return { ok: false, error: "Ordering opens on 10 December." };
  const details = { name: String(input.name ?? ""), phone: String(input.phone ?? ""), email: String(input.email ?? "") };
  const fieldErrors = checkDetails(details);
  if (Object.keys(fieldErrors).length > 0) return { ok: false, error: "Please check your details.", fieldErrors };
  const phone = normaliseUkMobile(details.phone)!;

  const result = await getMenu();
  if (!result.ok) return { ok: false, error: "The menu could not be loaded. Please try again." };
  const menu = result.menu;
  const basket = priceBasket(pricingMenuFrom(menu), parseLines(input.lines));
  if (basket.lines.length === 0) return { ok: false, error: "Your basket is empty." };
  if (!basket.isValid) return { ok: false, error: "Something in your basket has changed. Please check your basket." };
  if (!paymentsConfigured()) return { ok: false, error: "Payments are not set up on this site yet." };

  const db = adminClient();
  const { data: shop } = await db.from("shops").select("id, shop_settings(is_accepting_orders)").eq("slug", "the-jacket-club-sr1").single();
  if (!shop) return { ok: false, error: "Shop not found." };
  const settings = (Array.isArray(shop.shop_settings) ? shop.shop_settings[0] : shop.shop_settings) as { is_accepting_orders: boolean } | null;
  if (!orderingOpen(now, settings?.is_accepting_orders ?? true)) return { ok: false, error: "We're not taking orders right now." };

  let pickupAt: string | null = null;
  let tableId: string | null = null;
  let tableNumber = "";
  if (input.orderType === "collect") {
    const slot = pickupSlots(menu.hours, now).find((s) => s.iso === input.pickupAt);
    if (!slot) return { ok: false, error: "Please choose a collection time.", fieldErrors: { pickupAt: "Please choose a collection time" } };
    pickupAt = slot.iso;
  } else if (input.orderType === "table") {
    const table = input.tableToken ? await tableForToken(input.tableToken) : null;
    if (!table) return { ok: false, error: "Please scan the QR code on your table to order to it." };
    if (!getOpenStatus(menu.hours, now).isOpen) return { ok: false, error: "We're closed right now, so we can't take table orders." };
    tableId = table.id;
    tableNumber = String(table.number);
  } else {
    return { ok: false, error: "Delivery and table booking are coming soon. Please choose Collect or Table." };
  }

  // Save the basket on the server so the order is built from our data, not the browser's.
  const { data: savedBasket, error: basketError } = await db
    .from("baskets")
    .insert({ shop_id: shop.id, device_token: randomBytes(16).toString("hex"), order_type: input.orderType, dining_table_id: tableId })
    .select("id")
    .single();
  if (basketError || !savedBasket) return { ok: false, error: "Could not save your basket. Please try again." };

  const lines = parseLines(input.lines);
  const { data: itemRows } = await db.from("items").select("id, code").eq("shop_id", shop.id).in("code", lines.map((l) => l.itemCode));
  const itemId = new Map((itemRows ?? []).map((r) => [r.code, r.id]));
  for (const line of lines) {
    const { data: bl, error } = await db
      .from("basket_lines")
      .insert({ basket_id: savedBasket.id, item_id: itemId.get(line.itemCode), quantity: line.quantity })
      .select("id")
      .single();
    if (error || !bl) return { ok: false, error: "Could not save your basket. Please try again." };
    const options = Object.values(line.choices).flatMap((picked) => Object.entries(picked).map(([optionId, count]) => ({ basket_line_id: bl.id, option_id: optionId, count })));
    if (options.length > 0) {
      const { error: optError } = await db.from("basket_line_options").insert(options);
      if (optError) return { ok: false, error: "Could not save your basket. Please try again." };
    }
  }

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const metadata = {
    basket_id: savedBasket.id,
    order_type: input.orderType,
    pickup_at: pickupAt ?? "",
    table_number: tableNumber,
    name: details.name.trim(),
    phone,
    email: details.email.trim(),
  };
  try {
    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: stripeLineItems(basket),
      customer_email: metadata.email || undefined,
      client_reference_id: savedBasket.id,
      metadata,
      payment_intent_data: { metadata: { basket_id: savedBasket.id }, description: "The Jacket Club SR1 order" },
      success_url: `${origin}/order/confirmed?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });
    if (!session.url) return { ok: false, error: "Could not open the payment page." };
    return { ok: true, url: session.url };
  } catch {
    return { ok: false, error: "Could not open the payment page. Please try again." };
  }
}
