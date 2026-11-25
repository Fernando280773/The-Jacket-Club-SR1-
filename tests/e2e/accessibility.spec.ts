import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automated WCAG 2.1 AA scan of the customer pages. Fails on serious or critical problems
// (missing labels, unreadable contrast, buttons with no name, and so on).
const pages = ["/", "/account", "/basket", "/book", "/terms", "/privacy", "/refunds", "/cookies", "/allergens", "/kitchen", "/driver"];

for (const path of pages) {
  test(`no serious accessibility problems on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const serious = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id}: ${v.help} (${v.nodes.length}× e.g. ${v.nodes[0]?.target.join(" ")})`);
    expect(serious, serious.join("\n")).toEqual([]);
  });
}

test("an item can be opened and added using only the keyboard", async ({ page }) => {
  await page.goto("/");
  const card = page.locator('[data-testid="item-card"][data-code="J01"]').getByRole("button");
  await card.focus();
  await page.keyboard.press("Enter");
  const add = page.getByTestId("add-to-basket");
  await expect(add).toBeVisible();
  await add.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("basket-bar")).toBeVisible();
});
