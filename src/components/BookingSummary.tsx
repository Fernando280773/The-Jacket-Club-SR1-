import { tablesText } from "@/lib/booking-email";
import { bookingWhen } from "@/lib/bookings";
import { formatPence } from "@/lib/money";

const ukTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export function BookingSummary({ b }: { b: { starts_at: string; ends_at: string; party_size: number; deposit_pence: number; tables: number[] } }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-2xl bg-club-cream p-4 text-left">
      <dt className="font-bold">When</dt>
      <dd data-testid="booking-when">
        {bookingWhen(b.starts_at)} to {ukTime(b.ends_at)}
      </dd>
      <dt className="font-bold">Party</dt>
      <dd>
        {b.party_size} {b.party_size === 1 ? "person" : "people"}
      </dd>
      <dt className="font-bold">{b.tables.length === 1 ? "Table" : "Tables"}</dt>
      <dd>{tablesText(b.tables).replace(/^Tables? /, "")}</dd>
      <dt className="font-bold">Deposit</dt>
      <dd>{formatPence(b.deposit_pence)} (off your bill)</dd>
    </dl>
  );
}
