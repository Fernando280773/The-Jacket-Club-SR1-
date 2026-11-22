import { expect, test, type Page } from "@playwright/test";

const openItem = async (page: Page, code: string) => {
  await page.locator(`[data-testid="item-card"][data-code="${code}"]`).getByRole("button").click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  return sheet;
};

test("build The Classic with options, change quantity, refresh, remove", async ({ page }) => {
  await page.goto("/");
  const sheet = await openItem(page, "J01");
  await expect(sheet.getByRole("heading", { name: "The Classic" })).toBeVisible();
  await expect(sheet.getByTestId("add-to-basket")).toHaveText("Add to basket · £5.50");

  await sheet.getByRole("group", { name: "Add a second filling" }).getByLabel("Cheese").check();
  await sheet.getByRole("group", { name: "Make it a meal" }).getByLabel("Can + fries").check();
  await expect(sheet.getByTestId("add-to-basket")).toHaveText("Add to basket · £9.30");
  await sheet.getByTestId("add-to-basket").click();
  await expect(sheet).toBeHidden();

  await expect(page.getByTestId("basket-bar")).toContainText("1 item · £9.30");
  await page.getByTestId("basket-bar").click();
  await expect(page).toHaveURL(/\/basket$/);

  const line = page.getByTestId("basket-line");
  await expect(line).toHaveCount(1);
  await expect(line).toContainText("Cheese · Can + fries");
  await expect(line.getByTestId("line-total")).toHaveText("£9.30");
  await expect(page.getByTestId("basket-subtotal")).toHaveText("£9.30");

  await page.getByRole("button", { name: "One more The Classic" }).click();
  await expect(page.getByTestId("basket-subtotal")).toHaveText("£18.60");

  await page.reload();
  await expect(page.getByTestId("line-quantity")).toHaveText("2");
  await expect(page.getByTestId("basket-subtotal")).toHaveText("£18.60");

  await page.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByTestId("basket-empty")).toBeVisible();
});

test("a wrap cannot be added until toasted or cold is chosen", async ({ page }) => {
  await page.goto("/");
  const sheet = await openItem(page, "W01");
  await sheet.getByTestId("add-to-basket").click();
  await expect(sheet.getByRole("alert")).toHaveText("Choose wrap style");
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Toasted").check();
  await sheet.getByTestId("add-to-basket").click();
  await expect(page.getByTestId("basket-bar")).toContainText("1 item · £6.95");
});

test("allergens update with the options chosen", async ({ page }) => {
  await page.goto("/");
  const sheet = await openItem(page, "J01");
  await expect(sheet.getByTestId("sheet-allergens")).toHaveText("Contains: Milk");
  await sheet.getByRole("group", { name: "Extras" }).getByLabel("Fried egg").check();
  await expect(sheet.getByTestId("sheet-allergens")).toHaveText("Contains: Eggs, Milk");
});

test("counters stop at the maximum (3 sauces)", async ({ page }) => {
  await page.goto("/");
  const sheet = await openItem(page, "J01");
  const sauces = sheet.getByRole("group", { name: "Sauces" });
  for (let i = 0; i < 3; i++) await sauces.getByRole("button", { name: "Add one Garlic mayo" }).click();
  await expect(sauces.getByRole("button", { name: "Add one Ketchup" })).toBeDisabled();
});

test("delivery under £12 shows how much more to add", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Delivery" }).click();
  const sheet = await openItem(page, "X01");
  await sheet.getByTestId("add-to-basket").click();
  await page.getByTestId("basket-bar").click();
  await expect(page.getByTestId("delivery-minimum")).toHaveText("Add £9.05 more for delivery (minimum order £12.00).");
  await page.getByRole("radio", { name: "Collect" }).click();
  await expect(page.getByTestId("delivery-minimum")).toBeHidden();
});

test("basket screenshots for review", async ({ page }) => {
  await page.goto("/");
  const sheet = await openItem(page, "J01");
  await sheet.getByRole("group", { name: "Add a second filling" }).getByLabel("Cheese").check();
  await page.screenshot({ path: "test-results/screens/item-sheet.png" });
  await sheet.getByTestId("add-to-basket").click();
  await page.screenshot({ path: "test-results/screens/basket-bar.png" });
  await page.getByTestId("basket-bar").click();
  await expect(page.getByTestId("basket-subtotal")).toHaveText("£6.30");
  await page.screenshot({ path: "test-results/screens/basket.png" });
});
