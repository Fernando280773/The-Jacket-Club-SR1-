import { expect, test, type Page } from "@playwright/test";

// Fakes the customer's Supabase login in the browser: no real accounts are created, read or changed.
const USER_ID = "00000000-0000-4000-8000-0000000000c1";

async function signedIn(page: Page, opts: { orders?: unknown[] } = {}) {
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  await page.addInitScript(([userId]) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(
      "jc-customer-auth",
      JSON.stringify({
        access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: exp,
        user: { id: userId, aud: "authenticated", role: "authenticated", email: "sam@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      }),
    );
  }, [USER_ID]);
  const now = new Date().toISOString();
  const orders = opts.orders ?? [
    { id: "o3", number: 1030, type: "collect", status: "preparing", created_at: now, pickup_at: now, total_pence: 120, access_token: "a".repeat(32),
      lines: [{ item_code: "C02", item_name: "Bottled Water", quantity: 1, line_total_pence: 120, options: [] }] },
    { id: "o2", number: 1020, type: "delivery", status: "delivered", created_at: now, pickup_at: now, total_pence: 360, access_token: "b".repeat(32),
      lines: [
        { item_code: "C02", item_name: "Bottled Water", quantity: 2, line_total_pence: 240, options: [] },
        { item_code: null, item_name: "Retired special", quantity: 1, line_total_pence: 120, options: [] },
      ] },
  ];
  await page.route("**/auth/v1/logout*", (r) => r.fulfill({ status: 204, body: "" }));
  await page.route("**/rest/v1/rpc/*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    const body = (r.request().postDataJSON() ?? {}) as Record<string, unknown>;
    calls.push({ name, body });
    if (name === "customer_account") {
      return r.fulfill({ json: { name: "Sam Smith", phone: "07700900123", email: "sam@example.com", marketing: false, addresses: [{ id: "a1", address: "1 Park Lane, Sunderland SR1 3NX", postcode: "SR1 3NX" }] } });
    }
    if (name === "customer_orders") return r.fulfill({ json: orders });
    if (name === "popular_items") return r.fulfill({ json: [{ item_code: "J01", orders: 9 }] });
    return r.fulfill({ status: 204, body: "" });
  });
  return { calls };
}

test("the menu links to the account page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("account-link").click();
  await expect(page).toHaveURL(/\/account$/);
});

test("signed out: sign in by email link (no password) or Google", async ({ page }) => {
  let otp: Record<string, unknown> | null = null;
  await page.route("**/auth/v1/otp*", async (r) => {
    otp = r.request().postDataJSON();
    await r.fulfill({ json: {} });
  });
  await page.goto("/account");
  await expect(page.getByTestId("google-sign-in")).toBeVisible();
  await page.getByTestId("send-link").click();
  await expect(page.locator("#account-error")).toContainText("valid email");
  await page.getByLabel("Email").fill("sam@example.com");
  await page.getByTestId("send-link").click();
  await expect(page.getByTestId("link-sent")).toContainText("sam@example.com");
  expect(otp).toMatchObject({ email: "sam@example.com", create_user: true });
});

test("signed in: current order, history, suggestions and saved address", async ({ page }) => {
  await signedIn(page);
  await page.goto("/account");
  await expect(page.getByTestId("account-greeting")).toHaveText("Hi Sam");
  await expect(page.getByTestId("current-order")).toContainText("#1030");
  await expect(page.getByTestId("current-order").getByRole("link", { name: "Track" })).toHaveAttribute("href", `/order/${"a".repeat(32)}`);
  await expect(page.getByTestId("past-order")).toHaveCount(2);
  await expect(page.getByTestId("suggest-last")).toContainText("Bottled Water");
  await expect(page.getByTestId("suggest-usual")).toContainText("ordered 2 times");
  await expect(page.getByTestId("saved-address")).toContainText("1 Park Lane");
});

test("reorder puts the items in the basket and names anything unavailable", async ({ page }) => {
  await signedIn(page);
  await page.goto("/account");
  await page.getByTestId("past-order").nth(1).getByRole("button", { name: "Reorder" }).click();
  await expect(page.getByTestId("account-notice")).toContainText("Retired special");
  await page.getByTestId("account-notice").getByRole("link", { name: "Go to basket" }).click();
  await expect(page).toHaveURL(/\/basket$/);
  await expect(page.getByText("Bottled Water").first()).toBeVisible();
});

test("details save with the marketing choice", async ({ page }) => {
  const { calls } = await signedIn(page);
  await page.goto("/account");
  await page.getByLabel("Name").fill("Sam Jones");
  await page.getByTestId("marketing").check();
  await page.getByTestId("save-details").click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  expect(calls.find((c) => c.name === "customer_update_account")?.body).toMatchObject({ p_name: "Sam Jones", p_phone: "07700900123", p_marketing: true });
});

test("delete account asks first, then signs out", async ({ page }) => {
  const { calls } = await signedIn(page);
  await page.goto("/account");
  await page.getByTestId("delete-account").click();
  await expect(page.getByText("can't be undone")).toBeVisible();
  await page.getByTestId("confirm-delete").click();
  await expect(page.getByTestId("send-link")).toBeVisible();
  expect(calls.some((c) => c.name === "customer_delete_account")).toBe(true);
});

test("a customer login does not open the staff screens", async ({ page }) => {
  await signedIn(page);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin sign in" })).toBeVisible();
  await page.goto("/kitchen");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
});
