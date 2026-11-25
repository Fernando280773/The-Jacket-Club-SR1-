"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase client for a customer's own account. Kept apart from the staff login (different storage key),
 * so a customer login never reaches the kitchen or admin screens. Reads only through the customer_* functions.
 */
export function customerClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase settings are missing");
  client = createClient(url, key, {
    // Implicit flow: the emailed link works even when opened on another phone or in the mail app's browser.
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "jc-customer-auth" },
  });
  return client;
}

/** The signed-in customer's login token for server actions, or undefined when signed out. */
export async function customerToken(): Promise<string | undefined> {
  try {
    const { data } = await customerClient().auth.getSession();
    return data.session?.access_token ?? undefined;
  } catch {
    return undefined;
  }
}
