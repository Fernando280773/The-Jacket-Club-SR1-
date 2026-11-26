import { siteOrigin } from "@/lib/server/site-origin";
import { confirmBookingSession, sendBookingEmailOnce } from "@/lib/server/bookings";
import { fulfilSession } from "@/lib/server/fulfil";
import { sendReceiptOnce } from "@/lib/server/receipt-email";
import { stripe } from "@/lib/server/stripe";
import { handleStripeWebhook } from "@/lib/server/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const result = await handleStripeWebhook(body, req.headers.get("stripe-signature"), {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    constructEvent: (b, s, k) => stripe().webhooks.constructEvent(b, s, k),
    fulfil: async (session) => {
      if (session.metadata?.kind === "booking") {
        // Table booking deposit.
        const b = await confirmBookingSession(session.id);
        if (b.ok) {
          await sendBookingEmailOnce(b.booking.id, siteOrigin(req));
          return { ok: true, orderId: b.booking.id, orderNumber: 0, created: true };
        }
        return b.reason === "error" ? { ok: false, reason: "error", message: b.message } : { ok: false, reason: "not_ours", message: b.reason };
      }
      const result = await fulfilSession(session.id);
      if (result.ok) await sendReceiptOnce(result.orderId, siteOrigin(req));
      return result;
    },
  });
  return new Response(result.message, { status: result.status });
}
