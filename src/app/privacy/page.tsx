import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata: Metadata = { title: "Privacy · The Jacket Club SR1" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      intro={
        <p>
          This explains what personal information we collect when you order, book or get a delivery from {COMPANY.tradingName}, why, who we share it with, and your rights.
        </p>
      }
    >
      <h2>Who is responsible for your information</h2>
      <p>
        {COMPANY.legalName} (trading as {COMPANY.tradingName}), company number {COMPANY.number}, registered office {COMPANY.registeredOffice}, is the controller of your
        personal information. Contact us about anything on this page at <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>.
        {COMPANY.icoNumber ? ` We are registered with the Information Commissioner's Office, number ${COMPANY.icoNumber}.` : ""}
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>When you order</strong>: your name, mobile number, email (if you give it), what you ordered, the time, and how you paid (but not your card details).
        </li>
        <li>
          <strong>For delivery</strong>: your delivery address, any door notes, and the address&apos;s map position and distance from the shop.
        </li>
        <li>
          <strong>For table bookings</strong>: your name, mobile, email, date, time, party size and the deposit paid or refunded.
        </li>
        <li>
          <strong>Payments</strong>: Stripe processes your card. We receive a payment reference and the amount, never your full card number.
        </li>
        <li>
          <strong>If you make an account</strong>: your email, name, mobile, any delivery addresses you choose to save, whether you want offers by email (and when you
          said so), and your past orders. If you sign in with Google, Google tells us your name and email address only.
        </li>
        <li>
          <strong>Staff</strong>: for our staff and drivers, their name, sign-in email, role and the orders they handled.
        </li>
      </ul>

      <h2>Why we use it, and our legal basis</h2>
      <ul>
        <li>
          <strong>To make, deliver and track your order or booking</strong>, send your receipt or confirmation, and contact you about it: this is needed to carry out our
          contract with you.
        </li>
        <li>
          <strong>To keep financial records</strong> for tax and accounting: we have a legal obligation to do this.
        </li>
        <li>
          <strong>To prevent fraud, handle complaints and refunds, and keep the service working well</strong>: this is in our legitimate interests, and we keep it to what
          is needed.
        </li>
      </ul>
      <ul>
        <li>
          <strong>To run your account</strong>: show your orders, let you order again and suggest things you might like based on your own orders (simple rules such as
          &quot;your usual&quot;, not profiling): this is needed for the service you asked for.
        </li>
        <li>
          <strong>Offers by email</strong>: only if you tick the box in your account. You can untick it at any time, and every email has a link to stop them.
        </li>
      </ul>

      <h2>Who we share it with</h2>
      <p>We use these providers to run the service. They act on our instructions and must keep your information safe:</p>
      <ul>
        <li>
          <strong>Supabase</strong>: our database, hosted in the EU (Ireland).
        </li>
        <li>
          <strong>Hostinger</strong>: runs this website, with servers in the UK.
        </li>
        <li>
          <strong>Stripe</strong>: card payments and refunds.
        </li>
        <li>
          <strong>Resend</strong>: sends our receipt and booking emails.
        </li>
        <li>
          <strong>Mapbox</strong>: looks up delivery addresses and road distance.
        </li>
        <li>
          <strong>Google</strong>: only if you choose &quot;Continue with Google&quot; to sign in.
        </li>
        <li>
          <strong>Cloudflare</strong>: checks the sign-in form isn&apos;t being used by a robot.
        </li>
      </ul>
      <p>
        Some of these companies are based in the United States. Where your information is handled outside the UK, it&apos;s protected by the UK&apos;s approved safeguards
        (the UK International Data Transfer Agreement or Addendum, or the UK-US data bridge). Our drivers see the name, phone number, address and items for the deliveries
        given to them, and only those. We never sell your information.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Orders, bookings and payment records: 6 years after the end of the financial year they belong to, as tax law requires. Then we delete them.</li>
        <li>
          Your account: until you delete it in your account page (or ask us to). Your login, saved details and addresses go straight away; past order records stay for the
          6 years above but are no longer linked to you.
        </li>
        <li>Staff accounts: while they work with us, plus 1 year.</li>
        <li>
          What&apos;s stored on your own device (your basket and last order) stays until you clear it. See <Link href="/cookies">cookies and storage</Link>.
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can ask us for a copy of your information, to correct it, to delete it (unless we must keep it by law), to restrict or object to how we use it, or to receive it in
        a portable format. Email <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>; we&apos;ll reply within one month. We don&apos;t make decisions about you by
        automated means alone.
      </p>
      <p>
        If you&apos;re unhappy with how we&apos;ve handled your information, please tell us first. You also have the right to complain to the Information Commissioner&apos;s
        Office at ico.org.uk or on 0303 123 1113.
      </p>

      <h2>Keeping it safe</h2>
      <p>
        Our systems use encrypted connections, access to customer information is limited to staff who need it, and staff sign in with their own accounts. Card details only ever
        go to Stripe.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy, we&apos;ll update this page and the date at the top.</p>
    </LegalPage>
  );
}
