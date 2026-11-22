import { isBeforeOpeningDay } from "../opening";

/**
 * Can customers place orders on this site right now?
 * The live site waits for opening day; preview links can take Stripe test orders.
 */
export function orderingOpen(now: Date, acceptingOrders = true): boolean {
  if (!acceptingOrders) return false;
  if (process.env.VERCEL_ENV === "production" && isBeforeOpeningDay(now)) return false;
  return true;
}
