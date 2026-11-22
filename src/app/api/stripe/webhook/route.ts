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
      const result = await fulfilSession(session.id);
      if (result.ok) await sendReceiptOnce(result.orderId, new URL(req.url).origin);
      return result;
    },
  });
  return new Response(result.message, { status: result.status });
}
