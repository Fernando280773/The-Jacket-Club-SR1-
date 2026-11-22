import type { Metadata } from "next";
import { AdminApp } from "./AdminApp";

export const metadata: Metadata = { title: "Admin · The Jacket Club SR1", robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminApp />;
}
