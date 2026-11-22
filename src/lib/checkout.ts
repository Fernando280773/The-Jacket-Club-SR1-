import type { PricedBasket } from "./pricing";

export type CheckoutDetails = { name: string; phone: string; email: string };

/** UK mobile in any common format (07…, +44 7…, spaces) → "+447…". Null if not a UK mobile. */
export function normaliseUkMobile(input: string): string | null {
  const digits = input.replace(/[\s()-]/g, "");
  const m = digits.match(/^(?:\+44|0044|0)(7\d{9})$/);
  return m ? `+44${m[1]}` : null;
}

export function checkDetails(d: CheckoutDetails): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = d.name.trim();
  if (name.length < 2 || name.length > 60) errors.name = "Please enter your name";
  if (!normaliseUkMobile(d.phone)) errors.phone = "Please enter a UK mobile number, like 07700 900123";
  const email = d.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Please check your email address";
  return errors;
}

/** Stripe line items from the server-priced basket. Amounts come only from the menu prices. */
export function stripeLineItems(basket: PricedBasket) {
  return basket.lines.map((l) => ({
    quantity: l.quantity,
    price_data: {
      currency: "gbp",
      unit_amount: l.unitPricePence,
      product_data: l.details ? { name: l.name, description: l.details.slice(0, 500) } : { name: l.name },
    },
  }));
}
