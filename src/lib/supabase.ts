import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Browser-safe Supabase client using the public (publishable) key. Reads only what the access rules allow. */
export function publicClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase settings are missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export const SHOP_SLUG = "the-jacket-club-sr1";
