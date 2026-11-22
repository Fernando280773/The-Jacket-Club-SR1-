import type { Metadata } from "next";
import { KitchenApp } from "./KitchenApp";

export const metadata: Metadata = { title: "Kitchen · The Jacket Club SR1", robots: { index: false, follow: false } };

export default function KitchenPage() {
  return <KitchenApp />;
}
