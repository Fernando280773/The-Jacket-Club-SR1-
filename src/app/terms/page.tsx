import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Terms of sale · The Jacket Club SR1" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of sale"
      intro={
        <p>
          These terms apply when you order food or book a table with {COMPANY.tradingName} through this website. Please read them before you pay. They don&apos;t affect
          your legal rights as a consumer.
        </p>
      }
    >
      <h2>Who we are</h2>
      <p>
        {COMPANY.tradingName} is a trading name of {COMPANY.legalName}, a company registered in {COMPANY.registeredIn} (company number {COMPANY.number}), registered
        office {COMPANY.registeredOffice}. Our shop is at {COMPANY.shopAddress}. Contact us at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
      </p>

      <h2>Ordering and payment</h2>
      <ul>
        <li>Prices are shown in pounds and are the full price you pay. We are not registered for VAT.</li>
        <li>Delivery orders also show a delivery fee before you pay.</li>
        <li>You pay by card when you order. Card payments are handled securely by Stripe; we never see or store your card number.</li>
        <li>Your order is accepted when your payment goes through and we show you an order number. If payment fails, no order is placed.</li>
        <li>If an item becomes unavailable after you&apos;ve paid, we&apos;ll contact you and offer a replacement or a refund for that item.</li>
      </ul>

      <h2>Collection and eating in</h2>
      <ul>
        <li>For collection, choose a time at checkout and show your order number at the counter.</li>
        <li>For table orders, scan the QR code on your table; we bring the food to that table.</li>
        <li>We keep collection orders for 30 minutes after the chosen time. After that, food quality can&apos;t be guaranteed.</li>
      </ul>

      <h2>Delivery</h2>
      <ul>
        <li>We deliver with our own drivers up to 4 miles by road from Park Lane. The minimum order is £12 of food, not counting the delivery fee.</li>
        <li>The fee is £1.99 for the first mile and £0.80 for each extra mile started, worked out from the road distance to your address.</li>
        <li>Delivery times are our best estimate. Please make sure someone is in and the address and phone number are right; we can&apos;t refund an order we couldn&apos;t deliver because of a wrong address or no one being in.</li>
      </ul>

      <h2>Table bookings</h2>
      <ul>
        <li>Tables are booked for 2 hours, up to 7 days ahead, for up to 20 people. A £2 per person deposit holds your table and comes off your bill when you order at your table.</li>
        <li>
          You can cancel from the link in your confirmation email. Cancel at least 2 hours before for a full refund; after that, or if you don&apos;t arrive, the deposit is kept. See our{" "}
          <Link href="/refunds">refund policy</Link>.
        </li>
        <li>If we have to cancel or move your booking, we&apos;ll tell you and refund the deposit in full if the new time doesn&apos;t suit you.</li>
      </ul>

      <h2>Cancelling an order</h2>
      <p>
        Because our food is made fresh to order, the 14-day right to cancel under the Consumer Contracts Regulations doesn&apos;t apply once we&apos;ve started preparing
        it. If something is wrong with your order, see our <Link href="/refunds">refund policy</Link>.
      </p>

      <h2>Allergies</h2>
      <p>
        Allergen information for every item is on our <Link href="/allergens">allergen page</Link> and in each item before you add it. We cook in one kitchen, so we can&apos;t
        promise any item is free from traces. If you have an allergy, please speak to us before ordering.
      </p>

      <h2>Our responsibility to you</h2>
      <p>
        If we don&apos;t keep to these terms, we&apos;re responsible for loss or damage you suffer that is a foreseeable result of that, up to the amount you paid for the order.
        Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law doesn&apos;t allow us to limit.
      </p>

      <h2>Your information</h2>
      <p>
        How we use your details is explained in our <Link href="/privacy">privacy policy</Link>.
      </p>

      <h2>The law</h2>
      <p>These terms are governed by the law of England and Wales. You can bring a claim in the courts of England and Wales, or of Scotland or Northern Ireland if you live there.</p>
    </LegalPage>
  );
}
