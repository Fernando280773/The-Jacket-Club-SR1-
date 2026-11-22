"use client";

import { staffClient } from "@/lib/staff-client";

/** Ask the site to rebuild the menu page now, so customers see an admin change within seconds. */
export async function refreshMenu(): Promise<void> {
  try {
    const { data } = await staffClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    await fetch("/api/admin/refresh", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // The menu page still refreshes itself within a minute.
  }
}

/** Turns a database refusal into words for the owner. */
export function friendlyError(message: string): string {
  if (/not allowed/i.test(message)) return "Your login isn't allowed to change this.";
  if (/between|characters|closing|list of/i.test(message)) return message.charAt(0).toUpperCase() + message.slice(1) + ".";
  return "Couldn't save. Check the Wi-Fi and try again.";
}
