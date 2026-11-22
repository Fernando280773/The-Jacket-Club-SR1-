import { bookingWhen } from "./bookings";
import { formatPence } from "./money";
import { COMPANY_LINE } from "./receipt";

export type BookingEmailData = {
  customer_name: string | null;
  starts_at: string;
  ends_at: string;
  party_size: number;
  deposit_pence: number;
  tables: number[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export const tablesText = (tables: number[]) => (tables.length === 1 ? `Table ${tables[0]}` : `Tables ${[...tables].sort((a, b) => a - b).join(", ")}`);

/** Subject, HTML and plain text for the booking confirmation. */
export function buildBookingEmail(b: BookingEmailData, manageUrl: string, refundNoticeHours: number) {
  const when = `${bookingWhen(b.starts_at)} to ${ukTime(b.ends_at)}`;
  const subject = `Your table at The Jacket Club: ${bookingWhen(b.starts_at)}`;
  const first = b.customer_name ? esc(b.customer_name.split(" ")[0]) : "";
  const deposit = formatPence(b.deposit_pence);
  const rule = `Cancel at least ${refundNoticeHours} hours before for a full refund. Your ${deposit} deposit comes off your bill when you order at your table.`;
  const html = `<!doctype html><html><body style="margin:0;background:#fbf6ea;font-family:Arial,Helvetica,sans-serif;color:#2a1d12">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:24px">
<tr><td style="font-size:22px;font-weight:bold;color:#1f4a2c">The Jacket Club SR1</td></tr>
<tr><td style="padding-top:16px;font-size:20px;font-weight:bold">You're booked${first ? `, ${first}` : ""}!</td></tr>
<tr><td style="padding-top:8px;font-size:16px">${esc(when)}<br>${b.party_size} ${b.party_size === 1 ? "person" : "people"} · ${esc(tablesText(b.tables))}<br>Deposit paid: <strong>${deposit}</strong></td></tr>
<tr><td style="padding-top:12px;font-size:14px;color:#6b5a48">${esc(rule)}</td></tr>
<tr><td style="padding-top:16px"><a href="${esc(manageUrl)}" style="display:inline-block;background:#1f4a2c;color:#fbf6ea;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:12px">Manage booking</a></td></tr>
<tr><td style="padding-top:20px;font-size:12px;color:#6b5a48">12–14 Park Lane, Sunderland SR1 3NX<br>${esc(COMPANY_LINE)}<br>Questions? Reply to this email or contact info@thejacketclubsr1.com</td></tr>
</table></td></tr></table></body></html>`;
  const text = [`The Jacket Club SR1: you're booked`, when, `${b.party_size} people · ${tablesText(b.tables)}`, `Deposit paid: ${deposit}`, rule, `Manage booking: ${manageUrl}`, "", COMPANY_LINE].join("\n");
  return { subject, html, text };
}
