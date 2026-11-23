import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

type MenuJson = {
  categories: string[];
  featured: string[];
  items: { code: string; name: string; price_pence: number; allergens: string[] }[];
};
const menu: MenuJson = JSON.parse(readFileSync(path.resolve(__dirname, "../../data/menu.json"), "utf8"));
const pounds = (p: number) => `£${(p / 100).toFixed(2)}`;

test("menu shows the shop, opening banner and live open/closed status", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "The Jacket Club SR1" })).toBeVisible();
  await expect(page.getByTestId("opening-banner")).toHaveText("Ordering opens 10 December");
  await expect(page.getByTestId("open-status")).toHaveText(/^(Open now · closes \d\d:\d\d|Closed · opens .+)$/);
  await expect(page.getByRole("radio", { name: "Collect" })).toHaveAttribute("aria-checked", "true");
});

test("every category and every item from the sheet is on the menu with the right price", async ({ page }) => {
  await page.goto("/");
  for (const c of menu.categories) {
    await expect(page.getByRole("heading", { level: 2, name: c, exact: true })).toBeVisible();
  }
  await expect(page.getByTestId("item-card")).toHaveCount(menu.items.length);
  for (const item of menu.items) {
    const card = page.locator(`[data-testid="item-card"][data-code="${item.code}"]`);
    await expect(card.getByRole("heading", { name: item.name, exact: true })).toBeVisible();
    await expect(card.getByTestId("price")).toHaveText(pounds(item.price_pence));
  }
});

test("The Classic is £5.50 with Halal badge and Club favourites row", async ({ page }) => {
  await page.goto("/");
  const classic = page.locator('[data-testid="item-card"][data-code="J01"]');
  await expect(classic.getByTestId("price")).toHaveText("£5.50");
  await expect(classic.getByText("Halal")).toBeVisible();
  await expect(classic.getByTestId("allergens")).toHaveText("Contains: Milk");
  await expect(page.getByTestId("favourite-card")).toHaveCount(menu.featured.length);
});

test("tapping a category tab jumps to that section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Menu categories" }).getByRole("link", { name: "Desserts" }).click();
  await expect(page).toHaveURL(/#desserts$/);
  await expect(page.getByRole("heading", { level: 2, name: "Desserts" })).toBeInViewport();
});

test("allergen table matches the sheet for every item", async ({ page }) => {
  await page.goto("/allergens");
  const table = page.getByTestId("allergen-table");
  await expect(table.locator("thead th")).toHaveCount(15);
  for (const item of menu.items) {
    const row = table.locator(`tr[data-code="${item.code}"]`);
    const ticked = await row.locator("td:has([aria-label^='Contains'])").evaluateAll((tds) =>
      tds.map((td) => td.getAttribute("data-allergen")).sort(),
    );
    expect(ticked, item.name).toEqual([...item.allergens].sort());
  }
});

test("menu loads in under 2 seconds on a simulated 4G phone", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "network throttling needs Chromium");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  // Typical 4G: ~9 Mbps down, ~3 Mbps up, 85 ms round trip.
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 85,
    downloadThroughput: (9 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
  });
  await page.goto("/"); // warm the server once, as a real visitor would find it
  const start = Date.now();
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator('[data-testid="item-card"][data-code="J01"]')).toBeVisible();
  const ms = Date.now() - start;
  console.log(`Menu loaded on 4G in ${ms} ms`);
  expect(ms).toBeLessThan(2000);
});

test("screenshots for review", async ({ page }, info) => {
  test.skip(info.project.name !== "pixel", "one set of screenshots is enough");
  await page.goto("/");
  await expect(page.getByTestId("open-status")).not.toHaveText("Checking hours…");
  await page.screenshot({ path: "test-results/screens/menu-top.png" });
  await page.screenshot({ path: "test-results/screens/menu-full.png", fullPage: true });
  await page.goto("/allergens");
  await page.screenshot({ path: "test-results/screens/allergens.png" });
});
