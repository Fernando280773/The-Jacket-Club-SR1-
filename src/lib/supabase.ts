import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Browser-safe Supabase client using the public (publishable) key. Reads only what the access rules allow. */
export function publicClient(opts: { fresh?: boolean } = {}): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase settings are missing: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  // fresh: never use a cached copy (checkout must see sold-out items and pauses the moment they happen).
  const global = opts.fresh ? { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) } : undefined;
  return createClient(url, key, { auth: { persistSession: false }, global });
}

export const SHOP_SLUG = "the-jacket-club-sr1";
