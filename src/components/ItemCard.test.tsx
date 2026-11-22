import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ItemCard } from "./ItemCard";
import type { MenuItem } from "@/lib/menu";

const classic: MenuItem = {
  code: "J01",
  name: "The Classic",
  description: "Fluffy jacket with butter and grated mature cheddar",
  pricePence: 550,
  isHalal: true,
  isAvailable: true,
  isFeatured: true,
  photoUrl: null,
  allergens: [{ id: 7, name: "Milk" }],
};

describe("item card", () => {
  it("shows price, Halal badge and allergens", () => {
    const html = renderToStaticMarkup(<ItemCard item={classic} />);
    expect(html).toContain("£5.50");
    expect(html).toContain("Halal");
    expect(html).toContain("Contains: Milk");
    expect(html).not.toContain("Sold out");
  });
  it("shows Sold out and greys the card when unavailable", () => {
    const html = renderToStaticMarkup(<ItemCard item={{ ...classic, isAvailable: false }} />);
    expect(html).toContain("Sold out");
    expect(html).toContain("grayscale");
  });
});
