"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Menu } from "@/lib/menu";
import { MAX_QUANTITY, priceBasket, pricingMenuFrom, sameChoices, type BasketLine, type Choices, type PricingMenu } from "@/lib/pricing";
import { ItemSheet } from "./ItemSheet";

export type OrderType = "collect" | "table" | "book" | "delivery";
export const ORDER_TYPES: { key: OrderType; label: string }[] = [
  { key: "collect", label: "Collect" },
  { key: "table", label: "Table" },
  { key: "book", label: "Book" },
  { key: "delivery", label: "Delivery" },
];

type BasketState = { lines: BasketLine[]; orderType: OrderType };

type BasketContextValue = BasketState & {
  ready: boolean;
  pricing: PricingMenu;
  deliveryMinPence: number;
  setOrderType: (t: OrderType) => void;
  addLine: (itemCode: string, choices: Choices, quantity: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  removeLine: (id: string) => void;
  clear: () => void;
  openItem: (code: string | null) => void;
};

const BasketContext = createContext<BasketContextValue | null>(null);
export const useBasket = () => useContext(BasketContext);

const STORAGE_KEY = "jc-basket-v1";
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function load(): BasketState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BasketState;
    if (!Array.isArray(parsed.lines)) return null;
    return { lines: parsed.lines, orderType: ORDER_TYPES.some((t) => t.key === parsed.orderType) ? parsed.orderType : "collect" };
  } catch {
    return null;
  }
}

/** Holds the basket on this phone (item codes, choices and quantities only; prices always come from the menu). */
export function BasketProvider({ menu, children }: { menu: Pick<Menu, "categories" | "groups" | "deliveryMinPence">; children: React.ReactNode }) {
  const pricing = useMemo(() => pricingMenuFrom(menu), [menu]);
  const [state, setState] = useState<BasketState>({ lines: [], orderType: "collect" });
  const [ready, setReady] = useState(false);
  const [openCode, setOpenCode] = useState<string | null>(null);

  useEffect(() => {
    const saved = load();
    if (saved) setState(saved);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or storage full: the basket still works until the page is closed.
    }
  }, [state, ready]);

  const addLine = useCallback((itemCode: string, choices: Choices, quantity: number) => {
    setState((s) => {
      const same = s.lines.find((l) => l.itemCode === itemCode && sameChoices(l.choices, choices));
      if (same) {
        return { ...s, lines: s.lines.map((l) => (l === same ? { ...l, quantity: Math.min(MAX_QUANTITY, l.quantity + quantity) } : l)) };
      }
      return { ...s, lines: [...s.lines, { id: newId(), itemCode, choices, quantity }] };
    });
  }, []);

  const value: BasketContextValue = {
    ...state,
    ready,
    pricing,
    deliveryMinPence: menu.deliveryMinPence,
    setOrderType: (orderType) => setState((s) => ({ ...s, orderType })),
    addLine,
    setQuantity: (id, quantity) =>
      setState((s) => ({ ...s, lines: s.lines.map((l) => (l.id === id ? { ...l, quantity: Math.max(1, Math.min(MAX_QUANTITY, quantity)) } : l)) })),
    removeLine: (id) => setState((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id) })),
    clear: () => setState((s) => ({ ...s, lines: [] })),
    openItem: setOpenCode,
  };

  const openItem = openCode ? pricing.items[openCode] : undefined;
  return (
    <BasketContext.Provider value={value}>
      {children}
      {openItem && <ItemSheet key={openItem.code} item={openItem} />}
    </BasketContext.Provider>
  );
}

/** Basket summary from the menu on this page, for the bar. The basket page re-prices on the server. */
export function useBasketSummary() {
  const basket = useBasket();
  return useMemo(() => {
    if (!basket) return { itemCount: 0, subtotalPence: 0 };
    const priced = priceBasket(basket.pricing, basket.lines);
    return { itemCount: priced.itemCount, subtotalPence: priced.subtotalPence };
  }, [basket]);
}
