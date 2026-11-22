import Stripe from "stripe";

let client: Stripe | null = null;

/** Server-only Stripe client. The secret key lives only in Vercel settings (STRIPE_SECRET_KEY). */
export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (process.env.VERCEL_ENV !== "production" && !key.startsWith("sk_test_")) {
    throw new Error("Preview sites must use a Stripe test key");
  }
  client ??= new Stripe(key);
  return client;
}

export const paymentsConfigured = () => !!process.env.STRIPE_SECRET_KEY && !!process.env.SUPABASE_SECRET_KEY;
