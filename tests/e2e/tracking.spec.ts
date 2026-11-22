import { expect, test } from "@playwright/test";

test("a made-up order link shows Order not found", async ({ page }) => {
  await page.goto("/order/0123456789abcdef0123456789abcdef");
  await expect(page.getByTestId("order-not-found")).toHaveText("Order not found");
});

test("a malformed order link reveals nothing", async ({ page }) => {
  await page.goto("/order/1001");
  await expect(page.getByTestId("order-not-found")).toBeVisible();
});

test("the menu shows no order bar when no order is remembered", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("item-card").first()).toBeVisible();
  await expect(page.getByTestId("your-order-bar")).toHaveCount(0);
});
