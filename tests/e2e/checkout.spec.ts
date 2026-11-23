import { expect, test } from "@playwright/test";

const addClassic = async (page: import("@playwright/test").Page) => {
  await page.goto("/");
  await page.locator('[data-testid="item-card"][data-code="J01"]').getByRole("button").click();
  await page.getByTestId("add-to-basket").click();
  await page.getByTestId("basket-bar").click();
};

test("basket goes to checkout with the server total and collection times", async ({ page }) => {
  await addClassic(page);
  await page.getByTestId("go-to-checkout").click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByTestId("checkout-total")).toHaveText("£5.50");
  await expect(page.getByTestId("pay-button")).toHaveText(/Pay £5.50|Pay/);
  const closed = await page.getByTestId("collection-closed").isVisible();
  if (!closed) {
    const options = page.getByLabel("Collection time (today)").locator("option");
    expect(await options.count()).toBeGreaterThan(0);
    await expect(options.first()).toHaveText(/^\d\d:(00|15|30|45)$/);
  }
});

test("checkout checks name and UK mobile before payment", async ({ page }) => {
  await addClassic(page);
  await page.getByTestId("go-to-checkout").click();
  // Wait until the page has priced the basket and worked out today's collection times.
  await expect(page.getByTestId("checkout-total")).toHaveText("£5.50");
  test.skip(await page.getByTestId("collection-closed").isVisible(), "collection closed at this time of day");
  await page.getByLabel("Name").fill("A");
  await page.getByLabel("Mobile number").fill("0191 123 4567");
  await page.getByTestId("pay-button").click();
  await expect(page.getByText("Please enter your name")).toBeVisible();
  await expect(page.getByText("Please enter a UK mobile number, like 07700 900123")).toBeVisible();
});

test("a cancelled payment keeps the basket and says nothing was charged", async ({ page }) => {
  await addClassic(page);
  await page.goto("/checkout?cancelled=1");
  await expect(page.getByTestId("payment-cancelled")).toContainText("You haven't been charged");
  await expect(page.getByTestId("checkout-total")).toHaveText("£5.50");
});

test("an unknown table code is refused", async ({ page }) => {
  await page.goto("/t/0000000000000000");
  await expect(page.getByText(/isn't recognised|could not be loaded/)).toBeVisible();
});

test("the thank-you page without a real payment places no order", async ({ page }) => {
  await page.goto("/order/confirmed");
  await expect(page.getByRole("heading", { name: /Checking your order|Payment not completed/ })).toBeVisible();
});
