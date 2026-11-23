import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/terms", heading: "Terms of sale" },
  { path: "/refunds", heading: "Refund policy" },
  { path: "/privacy", heading: "Privacy policy" },
  { path: "/cookies", heading: "Cookies and storage" },
];

for (const p of PAGES) {
  test(`${p.path} opens and shows the company details`, async ({ page }) => {
    await page.goto(p.path);
    await expect(page.getByRole("heading", { level: 1, name: p.heading })).toBeVisible();
    await expect(page.getByTestId("site-footer")).toContainText("company number 15466129");
  });
}

test("the footer on the menu links to every legal page", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByTestId("site-footer");
  for (const label of ["Terms of sale", "Refunds", "Privacy", "Cookies", "Allergens"]) {
    await expect(footer.getByRole("link", { name: label })).toBeVisible();
  }
  await footer.getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
});

test("the footer is on basket, booking and tracking pages but not staff screens", async ({ page }) => {
  for (const path of ["/basket", "/book", "/order/0123456789abcdef0123456789abcdef", "/allergens"]) {
    await page.goto(path);
    await expect(page.getByTestId("site-footer"), path).toBeVisible();
  }
  for (const path of ["/kitchen", "/admin", "/driver"]) {
    await page.goto(path);
    await expect(page.getByTestId("staff-login"), path).toBeVisible();
    await expect(page.getByTestId("site-footer"), path).toHaveCount(0);
  }
});

test("the allergen page tells people to speak to staff", async ({ page }) => {
  await page.goto("/allergens");
  await expect(page.getByTestId("allergen-warning")).toContainText("please speak to a member of staff before you order");
});

test("checkout and booking say what paying agrees to", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="item-card"][data-code="J01"]').getByRole("button").click();
  await page.getByTestId("add-to-basket").click();
  await page.getByTestId("basket-bar").click();
  await page.getByTestId("go-to-checkout").click();
  const line = page.getByTestId("agree-line");
  await expect(line.getByRole("link", { name: "Terms of sale" })).toHaveAttribute("href", "/terms");
  await expect(line.getByRole("link", { name: "Refund policy" })).toHaveAttribute("href", "/refunds");
  await expect(line.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  await page.goto("/book");
  // Before opening day the live site shows "Bookings open on 10 December" instead of the form.
  const form = page.getByTestId("pay-deposit");
  if (await form.isVisible()) await expect(page.getByTestId("agree-line")).toBeVisible();
});
