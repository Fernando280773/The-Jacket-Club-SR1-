"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { customerToken } from "@/lib/customer-client";

/** After paying as a guest: offer an account in one tap. Signed-in customers see where the order went. */
export function AccountPrompt() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    customerToken().then((t) => setSignedIn(!!t));
  }, []);
  if (signedIn === null) return null;
  if (signedIn) {
    return (
      <p data-testid="saved-to-account" className="mt-4 text-center text-sm">
        Saved to <Link href="/account" className="font-bold underline">your account</Link>.
      </p>
    );
  }
  return (
    <div data-testid="account-prompt" className="mt-6 flex flex-col items-center gap-2 rounded-2xl bg-club-mint p-4 text-center">
      <p className="font-bold">Save this order. Make an account</p>
      <p className="text-sm">See your orders and order again in one tap. Just your email, no password.</p>
      <Link href="/account" className="rounded-2xl bg-club-green px-5 py-3 font-bold text-club-paper">
        Make an account
      </Link>
    </div>
  );
}
