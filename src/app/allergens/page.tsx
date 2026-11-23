import type { Metadata } from "next";
import Link from "next/link";
import { getMenu } from "@/lib/menu";

export const revalidate = 60;
export const metadata: Metadata = { title: "Allergens · The Jacket Club SR1" };

export default async function AllergensPage() {
  const result = await getMenu();
  // After the first build, a failed refresh keeps showing the last good menu instead of an error.
  if (!result.ok && process.env.NEXT_PHASE !== "phase-production-build") throw new Error(result.error);
  if (!result.ok) {
    return <main className="p-4">Sorry, the allergen table could not be loaded right now.</main>;
  }
  const { menu } = result;

  return (
    <main className="px-4 py-6">
      <Link href="/" className="text-sm font-bold text-club-green underline">
        ← Back to menu
      </Link>
      <h1 className="mt-3 font-display text-2xl text-club-green">Allergen information</h1>
      <p className="mt-2 max-w-2xl text-sm text-club-muted">
        The 14 allergens UK law requires us to declare, for every item on our menu. Extras and sauces you add can contain
        others: each item&apos;s pop-up shows the allergens for exactly what you choose.
      </p>
      <div data-testid="allergen-warning" className="mt-3 max-w-2xl rounded-xl bg-club-butter/40 px-4 py-3 text-sm">
        <p className="font-bold">If you have a food allergy or intolerance, please speak to a member of staff before you order.</p>
        <p className="mt-1">
          We prepare all our food in one kitchen, using shared equipment and fryers. Although we take care, we can&apos;t guarantee
          that any item is free from allergens, including traces of nuts, sesame, gluten or milk. Our suppliers&apos; recipes can
          change, so we check labels regularly and update this table.
        </p>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-club-line" tabIndex={0} role="region" aria-label="Allergen table, scroll sideways for more">
        <table data-testid="allergen-table" className="min-w-max border-collapse text-xs">
          <thead className="bg-club-cream">
            <tr>
              <th scope="col" className="sticky left-0 bg-club-cream px-3 py-2 text-left">
                Item
              </th>
              {menu.allergens.map((a) => (
                <th key={a.id} scope="col" className="px-2 py-2 font-bold">
                  {a.name}
                </th>
              ))}
            </tr>
          </thead>
          {menu.categories.map((c) => (
            <tbody key={c.slug}>
              <tr>
                <th colSpan={menu.allergens.length + 1} scope="colgroup" className="bg-club-mint px-3 py-1.5 text-left text-club-green">
                  {c.name}
                </th>
              </tr>
              {c.items.map((item) => {
                const has = new Set(item.allergens.map((a) => a.id));
                return (
                  <tr key={item.code} data-code={item.code} className="border-t border-club-line">
                    <th scope="row" className="sticky left-0 bg-club-paper px-3 py-1.5 text-left font-normal whitespace-nowrap">
                      {item.name}
                    </th>
                    {menu.allergens.map((a) => (
                      <td key={a.id} data-allergen={a.name} className="px-2 py-1.5 text-center">
                        {has.has(a.id) ? <span aria-label={`Contains ${a.name}`}>●</span> : <span className="sr-only">No</span>}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
    </main>
  );
}
