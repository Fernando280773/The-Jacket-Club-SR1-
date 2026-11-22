import Image from "next/image";
import { getShopStatus } from "@/lib/shop-status";

// Always read live from the database, never a cached copy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const status = await getShopStatus();

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center gap-6 px-4 py-12 text-center">
      <Image src="/logo-512.png" alt="The Jacket Club SR1 logo" width={200} height={200} priority className="rounded-full" />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl text-club-green">The Jacket Club SR1</h1>
        <p className="text-lg">Opening 10 December</p>
        <p className="text-club-muted">12–14 Park Lane, Sunderland SR1 3NX</p>
      </div>
      <ul className="flex flex-wrap justify-center gap-2 text-sm font-bold">
        <li className="rounded-full bg-club-green px-3 py-1 text-club-paper">Click &amp; Collect</li>
        <li className="rounded-full bg-club-green px-3 py-1 text-club-paper">Order at your table</li>
        <li className="rounded-full bg-club-green px-3 py-1 text-club-paper">Book a table</li>
        <li className="rounded-full bg-club-green px-3 py-1 text-club-paper">Delivery</li>
      </ul>
      <p data-testid="db-status" className={`rounded-lg px-4 py-2 text-sm ${status.ok ? "bg-club-mint text-club-green" : "bg-club-cream text-club-ink"}`}>
        {status.ok
          ? `Database connected: ${status.shopName}, ${status.tableCount} tables (${status.bookableTables} bookable)`
          : `Database not connected: ${status.error}`}
      </p>
    </main>
  );
}
