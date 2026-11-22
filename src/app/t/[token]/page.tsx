import { tableForToken } from "@/lib/server/tables";
import { TableSetter } from "./TableSetter";

export const dynamic = "force-dynamic";

/** The page a table's QR code opens: remembers the table, then shows the menu. */
export default async function TablePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let table: Awaited<ReturnType<typeof tableForToken>> = null;
  try {
    table = await tableForToken(token);
  } catch {
    table = null;
  }
  if (!table) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
        <h1 className="font-display text-2xl text-club-green">The Jacket Club SR1</h1>
        <p>This table code isn&apos;t recognised. Please ask a member of staff.</p>
      </main>
    );
  }
  return <TableSetter token={token} number={table.number} />;
}
