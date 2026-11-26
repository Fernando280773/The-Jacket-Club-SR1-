/** One sticker: one item of one order. Built in the database (private.order_label_rows). */
export type Label = {
  position: number;
  total: number;
  name: string;
  number: number;
  type: "collect" | "table" | "delivery";
  pickupAt: string | null;
  tableNumber: number | null;
  createdAt: string;
  staffTest: boolean;
  token: string | null;
  itemName: string;
  options: { name: string; count: number }[];
  allergens: string[];
};

/** Printable dots across. 406 fits 58 mm rolls; 576 fits 80 mm rolls (203 dots per inch). */
export const LABEL_WIDTH = 406;
export const LABEL_PAD = 10;

/** Turns the database's label row into a Label, ignoring anything unexpected. */
export function parseLabel(raw: unknown): Label | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const type = r.type === "table" || r.type === "delivery" ? r.type : r.type === "collect" ? "collect" : null;
  if (!type || typeof r.item_name !== "string") return null;
  const options = Array.isArray(r.options)
    ? r.options.flatMap((o) => (o && typeof o === "object" && typeof (o as { name?: unknown }).name === "string" ? [{ name: String((o as { name: string }).name), count: Number((o as { count?: unknown }).count) || 1 }] : []))
    : [];
  return {
    position: Number(r.position) || 1,
    total: Number(r.total) || 1,
    name: typeof r.name === "string" && r.name ? r.name : "Customer",
    number: Number(r.number) || 0,
    type,
    pickupAt: typeof r.pickup_at === "string" ? r.pickup_at : null,
    tableNumber: typeof r.table_number === "number" ? r.table_number : null,
    createdAt: typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
    staffTest: r.staff_test === true,
    token: typeof r.token === "string" && /^[0-9a-f]{32}$/.test(r.token) ? r.token : null,
    itemName: r.item_name,
    options,
    allergens: Array.isArray(r.allergens) ? r.allergens.filter((a): a is string => typeof a === "string") : [],
  };
}

const ukClock = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const ukDay = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short" }).format(new Date(iso));

/** The banner line: how the order leaves the kitchen. */
export function serviceLine(l: Pick<Label, "type" | "pickupAt" | "tableNumber">): string {
  if (l.type === "table") return l.tableNumber ? `TABLE ${l.tableNumber}` : "TABLE";
  const word = l.type === "delivery" ? "DELIVERY" : "COLLECT";
  return l.pickupAt ? `${word} ${ukClock(l.pickupAt)}` : word;
}

/** Breaks text into lines of at most `max` characters, on spaces where it can. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.trim().split(/\s+/)) {
    let w = word;
    while (w.length > max) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(w.slice(0, max));
      w = w.slice(max);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= max) line += ` ${w}`;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export type LabelRow =
  | { kind: "head"; height: number; count: string; name: string; order: string }
  | { kind: "banner"; height: number; text: string }
  | { kind: "test"; height: number }
  | { kind: "item"; height: number; text: string }
  | { kind: "option"; height: number; text: string }
  | { kind: "allergen"; height: number; text: string; first: boolean; last: boolean }
  | { kind: "gap"; height: number }
  | { kind: "foot"; height: number; text: string; hasQr: boolean };

/**
 * The label as rows of fixed height, top to bottom, so the picture is exactly as long as it needs to be.
 * `width` is the printable width in dots; text sizes are chosen for 203 dots per inch.
 */
export function labelRows(l: Label, width = LABEL_WIDTH): LabelRow[] {
  const inner = width - LABEL_PAD * 2;
  const chars = (pxPerChar: number) => Math.max(8, Math.floor(inner / pxPerChar));
  const rows: LabelRow[] = [];
  rows.push({ kind: "head", height: 148, count: `${l.position} of ${l.total}`, name: l.name.slice(0, 11), order: l.number ? `#${l.number}` : "" });
  rows.push({ kind: "banner", height: 50, text: serviceLine(l) });
  if (l.staffTest) rows.push({ kind: "test", height: 34 });
  rows.push({ kind: "gap", height: 8 });
  for (const text of wrap(l.itemName, chars(19.5))) rows.push({ kind: "item", height: 40, text });
  for (const o of l.options) {
    const words = wrap(o.count > 1 ? `${o.name} x${o.count}` : o.name, chars(14.5) - 2);
    words.forEach((text, i) => rows.push({ kind: "option", height: 32, text: i === 0 ? `+ ${text}` : `  ${text}` }));
  }
  rows.push({ kind: "gap", height: 10 });
  const contains = wrap(l.allergens.length > 0 ? `Contains: ${l.allergens.join(", ")}` : "No allergens listed", chars(14.5) - 1);
  contains.forEach((text, i) => rows.push({ kind: "allergen", height: 34, text, first: i === 0, last: i === contains.length - 1 }));
  rows.push({ kind: "gap", height: 10 });
  rows.push({ kind: "foot", height: l.token ? 116 : 30, text: `${ukDay(l.createdAt)} ${ukClock(l.createdAt)}`, hasQr: !!l.token });
  return rows;
}

export const labelHeight = (rows: LabelRow[]) => rows.reduce((sum, r) => sum + r.height, 0) + LABEL_PAD * 2;

/** A made-up label for the preview in admin. */
export const SAMPLE_LABEL: Label = {
  position: 2,
  total: 3,
  name: "Sam",
  number: 1008,
  type: "collect",
  pickupAt: "2026-12-10T11:30:00Z",
  tableNumber: null,
  createdAt: "2026-12-10T11:04:00Z",
  staffTest: false,
  token: "0123456789abcdef0123456789abcdef",
  itemName: "Tuna Mayo & Sweetcorn",
  options: [
    { name: "Beans", count: 1 },
    { name: "Extra cheese", count: 2 },
    { name: "Turkey bacon", count: 1 },
  ],
  allergens: ["Eggs", "Fish", "Milk", "Mustard"],
};
