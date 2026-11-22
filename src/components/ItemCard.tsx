import { formatPence } from "@/lib/money";
import type { MenuItem } from "@/lib/menu";

/** Photo placeholder until real food photos arrive after opening. */
function PhotoPlaceholder({ name, size }: { name: string; size: "sm" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl bg-club-cream font-display text-club-green/60 ${
        size === "lg" ? "h-28 w-full text-3xl" : "h-20 w-20 text-xl"
      }`}
    >
      {initials}
    </div>
  );
}

export function HalalBadge() {
  return (
    <span className="rounded-full bg-club-mint px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-club-green">
      Halal
    </span>
  );
}

export function ItemCard({ item }: { item: MenuItem }) {
  const soldOut = !item.isAvailable;
  return (
    <article
      data-testid="item-card"
      data-code={item.code}
      aria-label={item.name}
      className={`flex gap-3 border-b border-club-line py-4 ${soldOut ? "opacity-50 grayscale" : ""}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-bold leading-snug">{item.name}</h3>
        {item.description && <p className="text-sm text-club-muted">{item.description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span data-testid="price" className="font-bold text-club-green">
            {formatPence(item.pricePence)}
          </span>
          {item.isHalal && <HalalBadge />}
          {soldOut && (
            <span className="rounded-full bg-club-ink px-2 py-0.5 text-[11px] font-bold uppercase text-club-paper">Sold out</span>
          )}
        </div>
        {item.allergens.length > 0 && (
          <p data-testid="allergens" className="text-xs text-club-muted">
            Contains: {item.allergens.map((a) => a.name).join(", ")}
          </p>
        )}
      </div>
      <PhotoPlaceholder name={item.name} size="sm" />
    </article>
  );
}

export function FavouriteCard({ item }: { item: MenuItem }) {
  return (
    <article
      data-testid="favourite-card"
      aria-label={item.name}
      className={`flex w-40 shrink-0 snap-start flex-col gap-2 ${item.isAvailable ? "" : "opacity-50 grayscale"}`}
    >
      <PhotoPlaceholder name={item.name} size="lg" />
      <h3 className="text-sm font-bold leading-snug">{item.name}</h3>
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-club-green">{formatPence(item.pricePence)}</span>
        {!item.isAvailable && <span className="text-[11px] font-bold uppercase">Sold out</span>}
      </div>
    </article>
  );
}
