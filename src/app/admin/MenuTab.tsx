"use client";

import { useCallback, useEffect, useState } from "react";
import type { Staff } from "@/components/StaffGate";
import { MAX_EXTRA_PENCE, penceToPounds, poundsToPence } from "@/lib/admin";
import { formatPence } from "@/lib/money";
import { staffClient } from "@/lib/staff-client";
import { ItemEditor, type AdminItem } from "./ItemEditor";
import { friendlyError, refreshMenu } from "./refresh";

type AdminCategory = { name: string; sort: number; items: AdminItem[] };
type AdminOption = { id: string; name: string; price_change_pence: number; is_available: boolean; sort: number };
type AdminGroup = { code: string; name: string; options: AdminOption[] };

/** Owner: edit items and extras. Stock mode (kitchen): only Sold out / Back on switches. */
export function MenuTab({ staff, mode }: { staff: Staff; mode: "owner" | "stock" }) {
  const [cats, setCats] = useState<AdminCategory[] | null>(null);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = staffClient();
    const [c, g] = await Promise.all([
      db.from("categories").select("name, sort, items(id, code, name, description, price_pence, is_available, is_featured, photo_url, sort)").eq("shop_id", staff.shopId).order("sort"),
      db.from("option_groups").select("code, name, options(id, name, price_change_pence, is_available, sort)").eq("shop_id", staff.shopId).order("code"),
    ]);
    if (c.error || g.error) {
      setNotice("Couldn't load the menu. Check the Wi-Fi.");
      return;
    }
    setCats(((c.data ?? []) as AdminCategory[]).map((cat) => ({ ...cat, items: [...cat.items].sort((a, b) => a.sort - b.sort) })));
    setGroups(((g.data ?? []) as AdminGroup[]).map((grp) => ({ ...grp, options: [...grp.options].sort((a, b) => a.sort - b.sort) })));
  }, [staff.shopId]);

  useEffect(() => {
    load();
  }, [load]);

  const after = async (error: { message: string } | null, ok: string) => {
    setNotice(error ? friendlyError(error.message) : ok);
    if (!error) refreshMenu();
    await load();
    setBusy(null);
  };

  const toggleItem = async (item: AdminItem) => {
    setBusy(item.id);
    const { error } = await staffClient().rpc("set_item_available", { p_item_id: item.id, p_available: !item.is_available });
    await after(error, `${item.name} is ${item.is_available ? "now sold out" : "back on"}.`);
  };

  const toggleOption = async (o: AdminOption) => {
    setBusy(o.id);
    const { error } = await staffClient().rpc("set_option_available", { p_option_id: o.id, p_available: !o.is_available });
    await after(error, `${o.name} is ${o.is_available ? "now sold out" : "back on"}.`);
  };

  const saveOptionPrice = async (o: AdminOption, text: string) => {
    const pence = poundsToPence(text, MAX_EXTRA_PENCE);
    if (pence === null) {
      setNotice(`${o.name}: enter a price from £0 to £20, like 0.80`);
      return;
    }
    if (pence === o.price_change_pence) return;
    setBusy(o.id);
    const { error } = await staffClient().rpc("admin_update_option_price", { p_option_id: o.id, p_price_change_pence: pence });
    await after(error, `${o.name} now costs ${formatPence(pence)} extra.`);
  };

  if (!cats) return <p>{notice || "Loading…"}</p>;

  const q = search.trim().toLowerCase();
  const match = (name: string) => !q || name.toLowerCase().includes(q);
  const soldOutCount = cats.reduce((n, c) => n + c.items.filter((i) => !i.is_available).length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          data-testid="menu-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the menu"
          className="flex-1 rounded-xl border border-club-line bg-white px-3 py-2"
        />
        <span className="text-sm font-bold text-club-muted">{soldOutCount} sold out</span>
      </div>
      {notice && (
        <p role="status" data-testid="menu-notice" className="rounded-xl bg-club-cream px-3 py-2 font-bold">
          {notice}
        </p>
      )}

      {cats.map((cat) => {
        const items = cat.items.filter((i) => match(i.name));
        if (items.length === 0) return null;
        return (
          <section key={cat.name} aria-label={cat.name}>
            <h2 className="mb-1 font-display text-lg text-club-green">{cat.name}</h2>
            <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
              {items.map((item) => (
                <li key={item.id} data-testid="admin-item" data-code={item.code} className="flex items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className={`font-bold ${item.is_available ? "" : "text-club-muted line-through"}`}>{item.name}</p>
                    <p className="text-sm text-club-muted">
                      {formatPence(item.price_pence)}
                      {item.is_featured && " · Club favourite"}
                      {item.photo_url && " · Photo"}
                    </p>
                  </div>
                  {mode === "owner" && (
                    <button type="button" data-testid="edit-item" onClick={() => setEditing(item)} className="rounded-xl border border-club-line px-3 py-2 text-sm font-bold">
                      Edit
                    </button>
                  )}
                  <SoldOutSwitch available={item.is_available} busy={busy === item.id} label={item.name} onToggle={() => toggleItem(item)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section aria-label="Extras and options">
        <h2 className="mb-1 font-display text-lg text-club-green">Extras and options</h2>
        <p className="mb-2 text-sm text-club-muted">Sold out here hides that choice in every item that offers it.{mode === "owner" ? " Prices are what the option adds." : ""}</p>
        {groups.map((g) => {
          const options = g.options.filter((o) => match(o.name) || match(g.name));
          if (options.length === 0) return null;
          return (
            <div key={g.code} className="mb-3">
              <h3 className="text-sm font-bold text-club-muted">{g.name}</h3>
              <ul className="flex flex-col divide-y divide-club-line rounded-2xl bg-white">
                {options.map((o) => (
                  <li key={o.id} data-testid="admin-option" className="flex items-center gap-3 px-3 py-2">
                    <span className={`flex-1 ${o.is_available ? "" : "text-club-muted line-through"}`}>{o.name}</span>
                    {mode === "owner" ? (
                      <label className="flex items-center gap-1 text-sm">
                        +£
                        <input
                          key={o.price_change_pence}
                          aria-label={`${o.name} extra price`}
                          defaultValue={penceToPounds(o.price_change_pence)}
                          inputMode="decimal"
                          onBlur={(e) => saveOptionPrice(o, e.target.value)}
                          className="w-16 rounded-lg border border-club-line px-2 py-1"
                        />
                      </label>
                    ) : (
                      o.price_change_pence > 0 && <span className="text-sm text-club-muted">+{formatPence(o.price_change_pence)}</span>
                    )}
                    <SoldOutSwitch available={o.is_available} busy={busy === o.id} label={o.name} onToggle={() => toggleOption(o)} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </section>

      {editing && (
        <ItemEditor
          staff={staff}
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={async (msg) => {
            setEditing(null);
            setNotice(msg);
            refreshMenu();
            await load();
          }}
        />
      )}
    </div>
  );
}

function SoldOutSwitch({ available, busy, label, onToggle }: { available: boolean; busy: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-testid="sold-out-toggle"
      aria-pressed={!available}
      aria-label={available ? `Mark ${label} sold out` : `Put ${label} back on`}
      disabled={busy}
      onClick={onToggle}
      className={`w-28 shrink-0 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50 ${available ? "bg-club-mint text-club-green" : "bg-club-ink text-club-paper"}`}
    >
      {available ? "On menu" : "Sold out"}
    </button>
  );
}
