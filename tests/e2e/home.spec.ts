import { expect, test } from "@playwright/test";

test("home page shows the shop and a live database connection", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "The Jacket Club SR1" })).toBeVisible();
  await expect(page.getByText("Opening 10 December")).toBeVisible();
  await expect(page.getByTestId("db-status")).toHaveText(
    "Database connected: The Jacket Club SR1, 15 tables (10 bookable)",
  );
});
