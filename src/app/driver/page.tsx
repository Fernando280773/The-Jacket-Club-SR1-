import type { Metadata } from "next";
import { DriverApp } from "./DriverApp";

export const metadata: Metadata = { title: "Driver · The Jacket Club SR1", robots: { index: false, follow: false } };

export default function DriverPage() {
  return <DriverApp />;
}
