import { expect, test, type Page } from "@playwright/test";

// Fakes Supabase in the browser, so these tests never change the real menu or need a real login.

const USER_ID = "00000000-0000-4000-8000-000000000002";
const SHOP_ID = "00000000-0000-4000-8000-0000000000aa";

test("admin asks for a staff login first", async ({ page }) => {
  await page.goto("/admin");
  await expect(page.getByTestId("staff-login")).toHaveText("Admin sign in");
});

async function fakeAdmin(page: Page, role: "owner" | "kitchen") {
  const rpc: { name: string; body: Record<string, unknown> }[] = [];
  const items = [
    { id: "i1", code: "J01", name: "The Classic", description: "Butter and cheese", price_pence: 550, is_available: true, is_featured: true, photo_url: null, sort: 10 },
    { id: "i2", code: "J02", name: "Beef Chilli & Cheese", description: null, price_pence: 850, is_available: false, is_featured: false, photo_url: null, sort: 20 },
  ];
  await page.addInitScript(
    ([userId]) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        "jc-staff-auth",
        JSON.stringify({ access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: userId, aud: "authenticated", role: "authenticated", email: "x@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }),
      );
    },
    [USER_ID],
  );
  await page.route("**/rest/v1/staff_users*", (r) => r.fulfill({ json: { shop_id: SHOP_ID, name: role === "owner" ? "Antony" : "Kitchen tablet", role, is_active: true } }));
  await page.route("**/rest/v1/categories*", (r) => r.fulfill({ json: [{ name: "Jacket Potatoes", sort: 10, items }] }));
  await page.route("**/rest/v1/option_groups*", (r) => r.fulfill({ json: [{ code: "G_EXTRA", name: "Extras", options: [{ id: "o1", name: "Fried egg", price_change_pence: 80, is_available: true, sort: 1 }] }] }));
  await page.route("**/rest/v1/orders*", (r) => r.fulfill({ json: [
    { number: 1003, status: "received", type: "collect", total_pence: 1250, created_at: new Date().toISOString() },
    { number: 1002, status: "collected", type: "table", total_pence: 750, created_at: new Date().toISOString() },
    { number: 1001, status: "cancelled", type: "collect", total_pence: 990, created_at: new Date().toISOString() },
  ] }));
  await page.route("**/rest/v1/shop_settings*", (r) => r.fulfill({ json: { is_accepting_orders: true, paused_message: null } }));
  await page.route("**/rest/v1/rpc/*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    const body = r.request().postDataJSON() as Record<string, unknown>;
    rpc.push({ name, body });
    if (name === "set_item_available") {
      const it = items.find((i) => i.id === body.p_item_id);
      if (it) it.is_available = body.p_available as boolean;
    }
    if (name === "admin_update_item") {
      const it = items.find((i) => i.id === body.p_item_id);
      if (it) it.price_pence = body.p_price_pence as number;
    }
    await r.fulfill({ status: 204, body: "" });
  });
  await page.route("**/api/admin/refresh", (r) => r.fulfill({ json: { ok: true } }));
  return { rpc };
}

test("kitchen login only gets Sold out and Bookings", async ({ page }) => {
  const { rpc } = await fakeAdmin(page, "kitchen");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Kitchen admin" })).toBeVisible();
  await expect(page.getByTestId("tab-today")).toHaveCount(0);
  await expect(page.getByTestId("tab-bookings")).toBeVisible();
  await expect(page.getByTestId("edit-item")).toHaveCount(0);

  const classic = page.locator('[data-testid=admin-item][data-code="J01"]');
  await classic.getByTestId("sold-out-toggle").click();
  await expect(classic.getByTestId("sold-out-toggle")).toHaveText("Sold out");
  expect(rpc).toContainEqual({ name: "set_item_available", body: { p_item_id: "i1", p_available: false } });
});

test("owner sees today's totals and changes a price in pounds, saved as pence", async ({ page }) => {
  const { rpc } = await fakeAdmin(page, "owner");
  await page.goto("/admin");
  // Cancelled orders don't count: 2 orders, £20.00 taken, £10.00 average.
  await expect(page.getByTestId("stat-orders")).toHaveText("2");
  await expect(page.getByTestId("stat-taken")).toHaveText("£20.00");
  await expect(page.getByTestId("stat-average")).toHaveText("£10.00");

  await page.getByTestId("tab-menu").click();
  await page.locator('[data-testid=admin-item][data-code="J01"]').getByTestId("edit-item").click();
  await page.getByTestId("edit-price").fill("abc");
  await page.getByTestId("save-item").click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Enter a price");
  expect(rpc.filter((c) => c.name === "admin_update_item")).toHaveLength(0);

  await page.getByTestId("edit-price").fill("5.95");
  await page.getByTestId("save-item").click();
  await expect(page.getByTestId("menu-notice")).toContainText("now £5.95");
  expect(rpc.find((c) => c.name === "admin_update_item")?.body).toMatchObject({ p_item_id: "i1", p_price_pence: 595 });
});

test("owner can pause ordering with a message", async ({ page }) => {
  const { rpc } = await fakeAdmin(page, "owner");
  await page.goto("/admin");
  await page.getByTestId("paused-message").fill("Back at 2pm");
  await page.getByTestId("toggle-ordering").click();
  await expect(page.getByTestId("toggle-ordering")).toHaveText("Start taking orders");
  expect(rpc).toContainEqual({ name: "admin_set_ordering", body: { p_shop_id: SHOP_ID, p_accepting: false, p_message: "Back at 2pm" } });
});

test("owner prints a QR card for the counter and every table", async ({ page }) => {
  await fakeAdmin(page, "owner");
  const tables = Array.from({ length: 15 }, (_, i) => ({ number: i + 1, token: `abc${String(i + 1).padStart(4, "0")}def00000` }));
  await page.route("**/api/staff/tables", (r) => r.fulfill({ json: { ok: true, tables } }));
  await page.goto("/admin?tab=qr");
  await expect(page.getByTestId("qr-counter")).toHaveAttribute("data-url", /\/$/);
  for (const t of tables) {
    const card = page.getByTestId(`qr-table-${t.number}`);
    await expect(card).toContainText(`Table ${t.number}`);
    await expect(card).toHaveAttribute("data-url", new RegExp(`/t/${t.token}$`));
    await expect(card.locator("svg")).toHaveCount(1);
  }
});

test("kitchen staff do not get the QR codes or staff test mode", async ({ page }) => {
  await fakeAdmin(page, "kitchen");
  await page.goto("/admin?tab=qr");
  await expect(page.getByTestId("tab-qr")).toHaveCount(0);
  await expect(page.getByTestId("toggle-staff-test")).toHaveCount(0);
});
