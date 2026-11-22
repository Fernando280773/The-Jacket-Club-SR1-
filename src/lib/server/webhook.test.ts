import { describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { handleStripeWebhook } from "./webhook";

const stripe = new Stripe("sk_test_dummy");
const SECRET = "whsec_test_secret";
const constructEvent = (b: string, s: string, k: string) => stripe.webhooks.constructEvent(b, s, k);
const body = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1", object: "checkout.session", payment_status: "paid", metadata: { basket_id: "b1" } } },
});
const sign = (payload: string, secret = SECRET) => stripe.webhooks.generateTestHeaderString({ payload, secret });

describe("Stripe webhook", () => {
  it("refuses a message without a valid Stripe signature", async () => {
    const fulfil = vi.fn();
    expect((await handleStripeWebhook(body, null, { secret: SECRET, constructEvent, fulfil })).status).toBe(400);
    expect((await handleStripeWebhook(body, sign(body, "whsec_wrong"), { secret: SECRET, constructEvent, fulfil })).status).toBe(400);
    expect(fulfil).not.toHaveBeenCalled();
  });

  it("creates the order from a signed checkout.session.completed", async () => {
    const fulfil = vi.fn().mockResolvedValue({ ok: true, orderId: "o1", orderNumber: 1001, created: true });
    const r = await handleStripeWebhook(body, sign(body), { secret: SECRET, constructEvent, fulfil });
    expect(r).toEqual({ status: 200, message: "Order 1001" });
    expect(fulfil).toHaveBeenCalledWith(expect.objectContaining({ id: "cs_test_1" }));
  });

  it("the same message twice still answers OK (the database returns the first order)", async () => {
    const fulfil = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, orderId: "o1", orderNumber: 1001, created: true })
      .mockResolvedValueOnce({ ok: true, orderId: "o1", orderNumber: 1001, created: false });
    const deps = { secret: SECRET, constructEvent, fulfil };
    expect((await handleStripeWebhook(body, sign(body), deps)).message).toBe("Order 1001");
    expect((await handleStripeWebhook(body, sign(body), deps)).message).toBe("Order 1001");
  });

  it("asks Stripe to retry if saving fails, and ignores other events", async () => {
    const failing = vi.fn().mockResolvedValue({ ok: false, reason: "error", message: "db down" });
    expect((await handleStripeWebhook(body, sign(body), { secret: SECRET, constructEvent, fulfil: failing })).status).toBe(500);
    const other = JSON.stringify({ id: "evt_2", object: "event", type: "charge.refunded", data: { object: {} } });
    const fulfil = vi.fn();
    expect(await handleStripeWebhook(other, sign(other), { secret: SECRET, constructEvent, fulfil })).toEqual({ status: 200, message: "Ignored" });
    expect(fulfil).not.toHaveBeenCalled();
  });
});
