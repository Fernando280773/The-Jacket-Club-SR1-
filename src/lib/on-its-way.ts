import { staffClient } from "./staff-client";

/** Asks the server to email the customer that their delivery has left. Never blocks or fails the staff screen. */
export async function notifyOnItsWay(orderId: string): Promise<void> {
  try {
    const { data } = await staffClient().auth.getSession();
    await fetch("/api/staff/delivery-email", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
      body: JSON.stringify({ orderId }),
      keepalive: true,
    });
  } catch {
    // The delivery itself is already saved; the email is a courtesy.
  }
}
