"use client";

import { useEffect, useRef, useState } from "react";
import type { MenuItem, OptionGroup } from "@/lib/menu";
import { formatPence } from "@/lib/money";
import { checkChoices, lineAllergens, MAX_QUANTITY, unitPricePence, type Choices } from "@/lib/pricing";
import { useBasket } from "./BasketProvider";
import { HalalBadge } from "./ItemCard";

function ruleText(g: OptionGroup): string {
  if (g.required) return g.min === g.max ? (g.max === 1 ? "Required · choose 1" : `Required · choose ${g.max}`) : `Required · choose ${g.min}–${g.max}`;
  return g.max === 1 ? "Optional" : `Optional · up to ${g.max}`;
}

const priceText = (pence: number) => (pence > 0 ? `+${formatPence(pence)}` : "");

function GroupPicker({ group, picked, onChange }: { group: OptionGroup; picked: Record<string, number>; onChange: (next: Record<string, number>) => void }) {
  const count = Object.values(picked).reduce((n, v) => n + v, 0);
  const full = count >= group.max;
  const headingId = `g-${group.code}`;

  return (
    <fieldset className="border-t border-club-line py-4" aria-labelledby={headingId}>
      <div className="flex items-baseline justify-between gap-2">
        <legend id={headingId} className="font-bold">
          {group.name}
        </legend>
        <span className={`text-xs ${group.required ? "font-bold text-club-green" : "text-club-muted"}`}>{ruleText(group)}</span>
      </div>
      <ul className="mt-2 flex flex-col">
        {group.options.map((o) => {
          const n = picked[o.id] ?? 0;
          const disabled = !o.isAvailable;
          const label = (
            <span className="flex flex-1 items-center justify-between gap-2">
              <span>
                {o.name}
                {disabled && <span className="ml-2 text-xs font-bold uppercase text-club-muted">Sold out</span>}
              </span>
              <span className="text-sm text-club-muted">{priceText(o.priceChangePence)}</span>
            </span>
          );

          if (group.control === "counter") {
            return (
              <li key={o.id} className={`flex items-center gap-3 py-2 ${disabled ? "opacity-50" : ""}`}>
                {label}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Remove one ${o.name}`}
                    disabled={n === 0}
                    onClick={() => {
                      const next = { ...picked };
                      if (n <= 1) delete next[o.id];
                      else next[o.id] = n - 1;
                      onChange(next);
                    }}
                    className="h-8 w-8 rounded-full border border-club-line font-bold disabled:opacity-30"
                  >
                    −
                  </button>
                  <span aria-label={`${o.name} count`} className="w-4 text-center font-bold">
                    {n}
                  </span>
                  <button
                    type="button"
                    aria-label={`Add one ${o.name}`}
                    disabled={disabled || full}
                    onClick={() => onChange({ ...picked, [o.id]: n + 1 })}
                    className="h-8 w-8 rounded-full border border-club-line font-bold disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </li>
            );
          }

          const isRadio = group.control === "pick_one" && group.max === 1;
          const checked = n > 0;
          return (
            <li key={o.id}>
              <label className={`flex cursor-pointer items-center gap-3 py-2 ${disabled || (!checked && full && !isRadio) ? "opacity-50" : ""}`}>
                <input
                  type={isRadio ? "radio" : "checkbox"}
                  name={group.code}
                  checked={checked}
                  disabled={disabled || (!checked && full && !isRadio)}
                  onChange={() => {}}
                  onClick={() => {
                    if (isRadio) onChange(checked && !group.required ? {} : { [o.id]: 1 });
                    else {
                      const next = { ...picked };
                      if (checked) delete next[o.id];
                      else next[o.id] = 1;
                      onChange(next);
                    }
                  }}
                  className="h-5 w-5 accent-club-green"
                />
                {label}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** Pop-up to choose options and add an item to the basket. */
export function ItemSheet({ item }: { item: MenuItem }) {
  const basket = useBasket();
  const [choices, setChoices] = useState<Choices>({});
  const [quantity, setQuantity] = useState(1);
  const [tried, setTried] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const close = () => basket?.openItem(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && basket?.openItem(null);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [basket]);

  if (!basket) return null;
  const groups = basket.pricing.groups;
  const errors = checkChoices(item, groups, choices);
  const total = unitPricePence(item, groups, choices) * quantity;
  const allergens = lineAllergens(item, groups, choices);

  const add = () => {
    if (errors.length > 0) {
      setTried(true);
      return;
    }
    basket.addLine(item.code, choices, quantity);
    close();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center">
      <div aria-hidden="true" className="absolute inset-0 bg-club-ink/50" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="relative flex max-h-[90dvh] w-full max-w-xl flex-col rounded-t-3xl bg-club-paper shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div className="flex flex-col gap-1">
            <h2 id="sheet-title" className="font-display text-xl leading-tight text-club-green">
              {item.name}
            </h2>
            {item.description && <p className="text-sm text-club-muted">{item.description}</p>}
            <div className="flex items-center gap-2">
              <span className="font-bold text-club-green">{formatPence(item.pricePence)}</span>
              {item.isHalal && <HalalBadge />}
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Close" className="h-9 w-9 shrink-0 rounded-full bg-club-cream text-lg font-bold">
            ×
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-4">
          <p data-testid="sheet-allergens" className="mt-3 text-xs text-club-muted">
            {allergens.length > 0 ? `Contains: ${allergens.map((a) => a.name).join(", ")}` : "No declared allergens"}
          </p>
          {item.groupCodes.map((code) =>
            groups[code] ? (
              <GroupPicker
                key={code}
                group={groups[code]}
                picked={choices[code] ?? {}}
                onChange={(next) => {
                  setChoices((c) => {
                    const updated = { ...c, [code]: next };
                    if (Object.keys(next).length === 0) delete updated[code];
                    return updated;
                  });
                }}
              />
            ) : null,
          )}
        </div>

        <div className="border-t border-club-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {tried && errors.length > 0 && (
            <p role="alert" className="mb-2 text-sm font-bold text-red-700">
              {errors[0]}
            </p>
          )}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <button type="button" aria-label="One less" disabled={quantity <= 1} onClick={() => setQuantity((q) => q - 1)} className="h-10 w-10 rounded-full border border-club-line font-bold disabled:opacity-30">
                −
              </button>
              <span data-testid="sheet-quantity" className="w-5 text-center font-bold">
                {quantity}
              </span>
              <button type="button" aria-label="One more" disabled={quantity >= MAX_QUANTITY} onClick={() => setQuantity((q) => q + 1)} className="h-10 w-10 rounded-full border border-club-line font-bold disabled:opacity-30">
                +
              </button>
            </div>
            <button
              type="button"
              data-testid="add-to-basket"
              onClick={add}
              aria-disabled={errors.length > 0}
              className={`flex-1 rounded-2xl px-4 py-3 font-bold text-club-paper ${errors.length > 0 ? "bg-club-green/40" : "bg-club-green"}`}
            >
              Add to basket · {formatPence(total)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
