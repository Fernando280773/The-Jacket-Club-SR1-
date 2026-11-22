import { expect, test } from "@playwright/test";

test("the Book button on the menu opens table booking", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Book" }).click();
  await expect(page).toHaveURL(/\/book$/);
  await expect(page.getByRole("heading", { name: "Book a table" })).toBeVisible();
});

test("the booking page explains the deposit and refund rule", async ({ page }) => {
  await page.goto("/book");
  await expect(page.getByText(/£2\.00 per person deposit/)).toBeVisible();
  await expect(page.getByText(/at least 2 hours before for a full refund/)).toBeVisible();
});

test("a made-up booking link reveals nothing", async ({ page }) => {
  await page.goto("/booking/0123456789abcdef0123456789abcdef");
  await expect(page.getByTestId("booking-not-found")).toBeVisible();
  await page.goto("/booking/not-a-token");
  await expect(page.getByTestId("booking-not-found")).toBeVisible();
});
