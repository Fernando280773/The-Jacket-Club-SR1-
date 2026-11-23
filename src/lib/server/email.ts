import "server-only";
const FROM = () => process.env.RECEIPT_FROM ?? "The Jacket Club SR1 <info@thejacketclubsr1.com>";

export const emailConfigured = () => !!process.env.RESEND_API_KEY;

/** Sends one email through Resend. The idempotency key stops a retry sending it twice. */
export async function sendEmail(msg: { to: string; subject: string; html: string; text: string; idempotencyKey: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": msg.idempotencyKey },
      body: JSON.stringify({ from: FROM(), to: [msg.to], reply_to: "info@thejacketclubsr1.com", subject: msg.subject, html: msg.html, text: msg.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
