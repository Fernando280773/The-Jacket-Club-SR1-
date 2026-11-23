import "server-only";
import { isBeforeOpeningDay } from "../opening";

/**
 * Can customers place orders on this site right now?
 * The live site waits for opening day (unless the owner has turned on staff test mode);
 * preview links can take Stripe test orders.
 */
export function orderingOpen(now: Date, acceptingOrders = true, staffTest = false): boolean {
  if (!acceptingOrders) return false;
  if (process.env.VERCEL_ENV === "production" && isBeforeOpeningDay(now) && !staffTest) return false;
  return true;
}
