import { fulfilSession } from "@/lib/server/fulfil";
import { stripe } from "@/lib/server/stripe";
import { handleStripeWebhook } from "@/lib/server/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.text();
  const result = await handleStripeWebhook(body, req.headers.get("stripe-signature"), {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    constructEvent: (b, s, k) => stripe().webhooks.constructEvent(b, s, k),
    fulfil: (session) => fulfilSession(session.id),
  });
  return new Response(result.message, { status: result.status });
}
