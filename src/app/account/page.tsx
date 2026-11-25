import type { Metadata } from "next";
import Link from "next/link";
import { BasketProvider } from "@/components/BasketProvider";
import { getMenu } from "@/lib/menu";
import { publicClient, SHOP_SLUG } from "@/lib/supabase";
import { AccountApp } from "./AccountApp";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account · The Jacket Club SR1" };

export default async function AccountPage() {
  const result = await getMenu({ fresh: true });
  if (!result.ok) throw new Error(result.error);
  const { data: shop } = await publicClient().from("shops").select("id").eq("slug", SHOP_SLUG).single();
  if (!shop) throw new Error("Shop not found");

  return (
    <BasketProvider menu={result.menu}>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <header className="flex items-center gap-3 py-4">
          <Link href="/" aria-label="Back to the menu" className="flex h-9 w-9 items-center justify-center rounded-full bg-club-cream font-bold">
            ←
          </Link>
          <h1 className="font-display text-2xl text-club-green">Your account</h1>
        </header>
        <AccountApp shopId={shop.id} menu={{ categories: result.menu.categories, groups: result.menu.groups }} />
      </main>
    </BasketProvider>
  );
}
