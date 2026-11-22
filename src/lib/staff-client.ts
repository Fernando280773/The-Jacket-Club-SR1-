"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Supabase client for the kitchen tablet. Uses the public key plus the staff member's own login,
 * so the database's access rules decide what the tablet can see. The login stays on the tablet.
 */
export function staffClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase settings are missing");
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "jc-staff-auth" },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}
