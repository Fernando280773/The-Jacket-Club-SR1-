import "server-only";
import { postcodeOf, SHOP_LOCATION } from "../delivery";

/** Mapbox is only called from our server. MAPBOX_ACCESS_TOKEN lives in Vercel settings, never in the browser. */
const token = () => process.env.MAPBOX_ACCESS_TOKEN;
export const mapboxConfigured = () => !!token();

export type AddressMatch = { label: string; postcode: string; latitude: number; longitude: number };

type GeocodeFeature = {
  properties: {
    full_address?: string;
    name?: string;
    place_formatted?: string;
    coordinates: { latitude: number; longitude: number };
    context?: { postcode?: { name?: string } };
  };
};

/** UK addresses matching what the customer has typed, nearest the shop first. */
export async function searchAddresses(query: string, limit = 5): Promise<AddressMatch[]> {
  const key = token();
  const q = query.trim().slice(0, 120);
  if (!key || q.length < 3) return [];
  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.search = new URLSearchParams({
    q,
    country: "gb",
    types: "address",
    autocomplete: "true",
    limit: String(limit),
    proximity: `${SHOP_LOCATION.longitude},${SHOP_LOCATION.latitude}`,
    language: "en",
    access_token: key,
  }).toString();
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Mapbox geocoding ${res.status}`);
  const data = (await res.json()) as { features?: GeocodeFeature[] };
  return (data.features ?? []).map((f) => {
    const p = f.properties;
    const label = p.full_address ?? [p.name, p.place_formatted].filter(Boolean).join(", ");
    return { label, postcode: p.context?.postcode?.name ?? postcodeOf(label), latitude: p.coordinates.latitude, longitude: p.coordinates.longitude };
  });
}

/** Driving distance in metres from the shop to a point. */
export async function roadMetresFromShop(to: { latitude: number; longitude: number }): Promise<number> {
  const key = token();
  if (!key) throw new Error("MAPBOX_ACCESS_TOKEN is not set");
  const path = `${SHOP_LOCATION.longitude},${SHOP_LOCATION.latitude};${to.longitude},${to.latitude}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${path}?overview=false&alternatives=false&access_token=${encodeURIComponent(key)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Mapbox directions ${res.status}`);
  const data = (await res.json()) as { routes?: { distance: number }[] };
  const metres = data.routes?.[0]?.distance;
  if (typeof metres !== "number") throw new Error("No route");
  return metres;
}
