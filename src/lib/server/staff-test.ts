import "server-only";
import { cookies } from "next/headers";
import { staffFromToken } from "./staff-auth";

/**
 * Staff test mode: lets the signed-in owner place real orders on the live site before opening day
 * (the £1-ish live payment test and the practice service). The cookie holds the owner's own login
 * token, is unreadable by page scripts, and is checked against Supabase on every use; it lapses
 * when that login token expires (about an hour).
 */
export const STAFF_TEST_COOKIE = "jc_staff_test";

export async function staffTestActive(): Promise<boolean> {
  const token = (await cookies()).get(STAFF_TEST_COOKIE)?.value;
  if (!token) return false;
  return (await staffFromToken(token, ["owner"])) !== null;
}
