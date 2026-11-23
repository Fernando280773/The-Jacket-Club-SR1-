"use client";

import { useEffect, useState, type ReactNode } from "react";
import { StaffGate, type Staff } from "@/components/StaffGate";
import { BookingsTab } from "./BookingsTab";
import { HoursTab } from "./HoursTab";
import { MenuTab } from "./MenuTab";
import { TodayTab } from "./TodayTab";
import { QrTab } from "./QrTab";

type Tab = "today" | "menu" | "bookings" | "hours" | "stock" | "qr";

const OWNER_TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "menu", label: "Menu" },
  { id: "bookings", label: "Bookings" },
  { id: "hours", label: "Opening hours" },
  { id: "qr", label: "QR codes" },
];
const KITCHEN_TABS: { id: Tab; label: string }[] = [
  { id: "stock", label: "Sold out" },
  { id: "bookings", label: "Bookings" },
];

/** Admin: the owner sees everything; kitchen staff only get the Sold out switches. */
export function AdminApp() {
  return (
    <StaffGate title="Admin sign in" roles={["owner", "kitchen"]}>
      {(staff, signOut) => <AdminShell staff={staff} signOut={signOut} />}
    </StaffGate>
  );
}

function AdminShell({ staff, signOut }: { staff: Staff; signOut: ReactNode }) {
  const isOwner = staff.role === "owner";
  const [tab, setTab] = useState<Tab>(isOwner ? "today" : "stock");

  const tabs = isOwner ? OWNER_TABS : KITCHEN_TABS;

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab") as Tab | null;
    const mapped = wanted === "stock" && isOwner ? "menu" : wanted;
    if (mapped && (isOwner ? OWNER_TABS : KITCHEN_TABS).some((t) => t.id === mapped)) setTab(mapped);
  }, [isOwner]);

  const choose = (t: Tab) => {
    setTab(t);
    window.history.replaceState(null, "", `/admin?tab=${t}`);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col">
      <header className="print:hidden flex flex-wrap items-center justify-between gap-3 bg-club-green px-4 py-3 text-club-paper">
        <h1 className="font-display text-xl">{isOwner ? "Admin" : "Kitchen admin"}</h1>
        <div className="flex items-center gap-3 text-sm">
          <a href="/kitchen" className="rounded-xl bg-club-paper/10 px-3 py-1.5 font-bold">
            Kitchen
          </a>
          <span>{staff.name}</span>
          {signOut}
        </div>
      </header>
      {(
        <nav aria-label="Admin sections" className="print:hidden flex gap-2 overflow-x-auto border-b border-club-line px-4 py-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              data-testid={`tab-${t.id}`}
              aria-current={tab === t.id ? "page" : undefined}
              onClick={() => choose(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${tab === t.id ? "bg-club-green text-club-paper" : "bg-club-cream"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <div className="flex-1 px-4 py-4">
        {tab === "today" && isOwner && <TodayTab staff={staff} />}
        {tab === "qr" && isOwner && <QrTab />}
        {tab === "menu" && isOwner && <MenuTab staff={staff} mode="owner" />}
        {tab === "hours" && isOwner && <HoursTab staff={staff} />}
        {tab === "bookings" && <BookingsTab staff={staff} />}
        {tab === "stock" && <MenuTab staff={staff} mode="stock" />}
      </div>
    </main>
  );
}
