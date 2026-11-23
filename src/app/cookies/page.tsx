import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Cookies · The Jacket Club SR1" };

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookies and storage"
      intro={<p>We only store what the website needs to work. We don&apos;t use tracking, analytics or advertising cookies, so we don&apos;t ask you to accept any.</p>}
    >
      <h2>What we store on your device</h2>
      <ul>
        <li>
          <strong>Your basket</strong>: the items you&apos;ve chosen, how you want your order (collect, table, delivery) and, for delivery, the address you picked, so your basket is
          still there if you leave the page.
        </li>
        <li>
          <strong>Your last order</strong>: its number and private tracking link, so the menu can show &ldquo;Your order&rdquo; and its progress.
        </li>
        <li>
          <strong>Staff sign-in</strong>: only on our kitchen, admin and driver screens, to keep staff signed in.
        </li>
      </ul>
      <p>
        These are kept in your browser&apos;s storage, are strictly necessary for the services you ask for, and are never used to track you. Under UK law (PECR) they don&apos;t
        need your consent. You can clear them at any time in your browser settings; your basket will be emptied.
      </p>

      <h2>Payment pages</h2>
      <p>
        When you pay, you go to Stripe&apos;s secure payment page, which uses its own cookies for security and fraud prevention. See Stripe&apos;s cookie policy at stripe.com.
      </p>

      <h2>Changes</h2>
      <p>
        If we ever add analytics or marketing cookies, we&apos;ll ask for your permission first and update this page. More about your information is in our{" "}
        <Link href="/privacy">privacy policy</Link>.
      </p>
    </LegalPage>
  );
}
