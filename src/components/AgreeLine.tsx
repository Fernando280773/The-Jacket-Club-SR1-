import Link from "next/link";

/** Shown under every Pay button: what the customer agrees to by paying. */
export function AgreeLine({ booking = false }: { booking?: boolean }) {
  return (
    <p data-testid="agree-line" className="text-center text-xs text-club-muted">
      By paying you agree to our <Link href="/terms" className="font-bold text-club-green underline">Terms of sale</Link> and{" "}
      <Link href="/refunds" className="font-bold text-club-green underline">{booking ? "deposit and refund policy" : "Refund policy"}</Link>. Our{" "}
      <Link href="/privacy" className="font-bold text-club-green underline">Privacy policy</Link> explains how we use your details.
    </p>
  );
}
