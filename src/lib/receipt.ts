import { formatPence } from "./money";

export type ReceiptOrder = {
  number: number;
  type: "collect" | "table" | "delivery";
  pickup_at: string | null;
  total_pence: number;
  /** Booking deposit taken off this order, if any. */
  deposit_credit_pence?: number;
  created_at: string;
  customer_name: string | null;
  dining_tables: { number: number } | null;
  order_lines: { item_name: string; quantity: number; line_total_pence: number; order_line_options: { option_name: string; count: number }[] }[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const ukDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const COMPANY_LINE = "Fernando & Sons Property Ltd trading as The Jacket Club SR1 · 12–14 Park Lane, Sunderland SR1 3NX";

function whereText(o: ReceiptOrder): string {
  if (o.type === "collect" && o.pickup_at) return `Collect from 12–14 Park Lane at ${ukTime(o.pickup_at)}`;
  if (o.type === "table" && o.dining_tables) return `We'll bring it to table ${o.dining_tables.number}`;
  return "";
}

const optionsText = (opts: { option_name: string; count: number }[]) => opts.map((o) => (o.count > 1 ? `${o.option_name} ×${o.count}` : o.option_name)).join(" · ");

/** Subject, HTML and plain text for the receipt email. Everything comes from the saved order. */
export function buildReceipt(o: ReceiptOrder, statusUrl: string) {
  const subject = `Your Jacket Club order #${o.number}`;
  const where = whereText(o);
  const rows = o.order_lines
    .map((l) => {
      const opts = optionsText(l.order_line_options);
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #e6d9bc"><strong>${l.quantity} × ${esc(l.item_name)}</strong>${opts ? `<br><span style="color:#6b5a48;font-size:13px">${esc(opts)}</span>` : ""}</td><td style="padding:8px 0;border-bottom:1px solid #e6d9bc;text-align:right;white-space:nowrap"><strong>${formatPence(l.line_total_pence)}</strong></td></tr>`;
    })
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#fbf6ea;font-family:Arial,Helvetica,sans-serif;color:#2a1d12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:24px">
<tr><td style="font-size:22px;font-weight:bold;color:#1f4a2c">The Jacket Club SR1</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:bold">Thank you${o.customer_name ? `, ${esc(o.customer_name.split(" ")[0])}` : ""}! Order #${o.number}</td></tr>
${where ? `<tr><td style="padding-top:6px;font-size:16px">${esc(where)}</td></tr>` : ""}
<tr><td style="padding-top:16px"><a href="${esc(statusUrl)}" style="display:inline-block;background:#1f4a2c;color:#fbf6ea;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Track your order</a></td></tr>
<tr><td style="padding-top:20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:15px">${rows}
${o.deposit_credit_pence ? `<tr><td style="padding-top:12px;color:#1f4a2c">Booking deposit</td><td style="padding-top:12px;text-align:right;color:#1f4a2c">−${formatPence(o.deposit_credit_pence)}</td></tr>` : ""}
<tr><td style="padding-top:12px;font-size:17px"><strong>Total paid</strong></td><td style="padding-top:12px;text-align:right;font-size:17px"><strong>${formatPence(o.total_pence)}</strong></td></tr></table></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b5a48">Ordered ${esc(ukDate(o.created_at))}. Prices include VAT. 100% halal.<br>${esc(COMPANY_LINE)}<br>Questions? Reply to this email or contact info@thejacketclubsr1.com</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `The Jacket Club SR1: order #${o.number}`,
    where,
    "",
    ...o.order_lines.map((l) => {
      const opts = optionsText(l.order_line_options);
      return `${l.quantity} x ${l.item_name}${opts ? ` (${opts})` : ""}: ${formatPence(l.line_total_pence)}`;
    }),
    "",
    ...(o.deposit_credit_pence ? [`Booking deposit: -${formatPence(o.deposit_credit_pence)}`] : []),
    `Total paid: ${formatPence(o.total_pence)}`,
    `Track your order: ${statusUrl}`,
    "",
    "Prices include VAT.",
    COMPANY_LINE,
  ]
    .filter((l, i, a) => !(l === "" && a[i - 1] === ""))
    .join("\n");
  return { subject, html, text };
}
