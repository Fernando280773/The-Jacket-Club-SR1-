import { COMPANY_LINE } from "./company";

export type OnItsWayOrder = {
  number: number;
  customer_name: string | null;
  deliveries: { address_text: string } | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Subject, HTML and plain text for the "your order is on its way" email, sent when the driver picks the order up. */
export function buildOnItsWay(o: OnItsWayOrder, statusUrl: string) {
  const subject = `Your Jacket Club order #${o.number} is on its way`;
  const first = o.customer_name?.trim().split(" ")[0] ?? "";
  const address = o.deliveries?.address_text ?? "";
  const html = `<!doctype html><html><body style="margin:0;background:#fbf6ea;font-family:Arial,Helvetica,sans-serif;color:#2a1d12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:24px">
<tr><td style="font-size:22px;font-weight:bold;color:#1f4a2c">The Jacket Club SR1</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:bold">${first ? `${esc(first)}, your` : "Your"} order #${o.number} is on its way</td></tr>
<tr><td style="padding-top:6px;font-size:16px">Our driver has picked it up${address ? ` and is heading to ${esc(address)}` : ""}. Please keep your phone nearby in case the driver calls.</td></tr>
<tr><td style="padding-top:16px"><a href="${esc(statusUrl)}" style="display:inline-block;background:#1f4a2c;color:#fbf6ea;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Track your order</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b5a48">${esc(COMPANY_LINE)}<br>Questions? Reply to this email or contact info@thejacketclubsr1.com</td></tr>
</table></td></tr></table></body></html>`;
  const text = [
    `The Jacket Club SR1: order #${o.number} is on its way`,
    `Our driver has picked it up${address ? ` and is heading to ${address}` : ""}.`,
    "Please keep your phone nearby in case the driver calls.",
    `Track your order: ${statusUrl}`,
    "",
    COMPANY_LINE,
  ].join("\n");
  return { subject, html, text };
}
