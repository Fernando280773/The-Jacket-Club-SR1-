import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Refunds · The Jacket Club SR1" };

export default function RefundsPage() {
  return (
    <LegalPage title="Refund policy" intro={<p>We want every order to be right. If it isn&apos;t, tell us and we&apos;ll put it right.</p>}>
      <h2>Something wrong with your order</h2>
      <ul>
        <li>If an item is missing, wrong, or not up to standard, tell us the same day: speak to staff, or email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a> with your order number.</li>
        <li>We&apos;ll offer a replacement or a refund for that item. A photo helps us look into it quickly.</li>
        <li>If a delivery is very late or doesn&apos;t arrive, we&apos;ll refund the delivery fee, and the food if it can&apos;t be delivered.</li>
      </ul>

      <h2>Changing your mind</h2>
      <p>
        Food is made fresh to order, so once we&apos;ve started preparing it we can&apos;t cancel or refund an order because you&apos;ve changed your mind. If you contact us
        before we&apos;ve started, we&apos;ll do our best to cancel it and refund you in full.
      </p>

      <h2>Table booking deposits</h2>
      <ul>
        <li>Cancel at least 2 hours before your booking from the link in your confirmation email, and your deposit is refunded in full automatically.</li>
        <li>If you cancel less than 2 hours before, or don&apos;t arrive, the deposit is kept.</li>
        <li>If we cancel or move your booking and the new time doesn&apos;t suit you, we refund the deposit in full.</li>
        <li>An unused deposit is taken off your bill when you order at your table during your booking.</li>
      </ul>

      <h2>How refunds are paid</h2>
      <p>Refunds go back to the card you paid with. They usually show within 5 to 10 working days, depending on your bank.</p>

      <h2>Your rights</h2>
      <p>This policy doesn&apos;t affect your legal rights under the Consumer Rights Act 2015.</p>
    </LegalPage>
  );
}
