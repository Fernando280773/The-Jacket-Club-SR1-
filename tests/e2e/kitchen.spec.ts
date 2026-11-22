import { expect, test, type Page } from "@playwright/test";

// The board test fakes Supabase in the browser, so it never touches real orders or needs a real staff login.

test("the kitchen asks for a staff login first", async ({ page }) => {
  await page.goto("/kitchen");
  await expect(page.getByTestId("kitchen-login")).toBeVisible();
  await expect(page.getByTestId("kitchen-order")).toHaveCount(0);
});

const USER_ID = "00000000-0000-4000-8000-000000000001";
const SHOP_ID = "00000000-0000-4000-8000-0000000000aa";

const line = (id: string, item_name: string, quantity: number, opts: string[] = []) => ({
  id,
  item_name,
  quantity,
  order_line_options: opts.map((option_name) => ({ option_name, count: 1 })),
});

function fakeOrders() {
  const now = Date.now();
  const ago = (m: number) => new Date(now - m * 60_000).toISOString();
  return [
    { id: "a", number: 1012, type: "collect", status: "received", pickup_at: ago(-20), created_at: ago(2), updated_at: ago(2), customer_name: "Sam Smith", note: null, dining_tables: null, order_lines: [line("l1", "The Classic", 2, ["Cheese", "Can + fries"])] },
    { id: "b", number: 1011, type: "table", status: "received", pickup_at: null, created_at: ago(16), updated_at: ago(16), customer_name: "Ali Khan", note: null, dining_tables: { number: 7 }, order_lines: [line("l2", "Chicken Tikka", 1)] },
    { id: "c", number: 1010, type: "collect", status: "preparing", pickup_at: ago(-5), created_at: ago(11), updated_at: ago(5), customer_name: "Jo", note: null, dining_tables: null, order_lines: [line("l3", "Double Smash", 1)] },
    { id: "d", number: 1009, type: "collect", status: "collected", pickup_at: ago(30), created_at: ago(40), updated_at: ago(20), customer_name: "Lee", note: null, dining_tables: null, order_lines: [line("l4", "Beans", 1)] },
  ];
}

async function fakeSupabase(page: Page) {
  const orders = fakeOrders();
  const rpcCalls: unknown[] = [];
  await page.addInitScript(
    ([userId]) => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      localStorage.setItem(
        "jc-staff-auth",
        JSON.stringify({ access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: userId, aud: "authenticated", role: "authenticated", email: "kitchen@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }),
      );
    },
    [USER_ID],
  );
  await page.route("**/rest/v1/staff_users*", (r) => r.fulfill({ json: { shop_id: SHOP_ID, name: "Test Kitchen", role: "kitchen", is_active: true } }));
  await page.route("**/rest/v1/orders*", (r) => r.fulfill({ json: orders }));
  await page.route("**/rest/v1/rpc/set_order_status", async (r) => {
    const body = r.request().postDataJSON() as { p_order_id: string; p_to: string };
    rpcCalls.push(body);
    const o = orders.find((x) => x.id === body.p_order_id);
    if (o) {
      o.status = body.p_to;
      o.updated_at = new Date().toISOString();
    }
    await r.fulfill({ json: body.p_to });
  });
  return { rpcCalls };
}

test("the board shows orders in columns and moves them on a tap", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const { rpcCalls } = await fakeSupabase(page);
  await page.goto("/kitchen");

  const fresh = page.getByTestId("col-new").getByTestId("kitchen-order");
  await expect(fresh).toHaveCount(2);
  // First in is first cooked: lowest number on top.
  await expect(fresh.first()).toHaveAttribute("data-number", "1011");
  await expect(fresh.first()).toContainText("Table 7");
  await expect(fresh.first()).toHaveAttribute("data-age", "red");
  await expect(fresh.nth(1)).toContainText("2 × The Classic");
  await expect(fresh.nth(1)).toContainText("Cheese · Can + fries");
  await expect(fresh.nth(1)).toHaveAttribute("data-age", "ok");
  await expect(page.getByTestId("col-preparing").getByTestId("kitchen-order")).toHaveAttribute("data-age", "amber");
  await expect(page.getByTestId("done-order")).toHaveCount(1);

  await fresh.nth(1).getByTestId("order-action").click();
  await expect(page.getByTestId("col-preparing").getByTestId("kitchen-order")).toHaveCount(2);
  // The card moves straight away; the database call follows a moment later.
  await expect.poll(() => rpcCalls).toContainEqual({ p_order_id: "a", p_from: "received", p_to: "preparing" });

  const ready = page.getByTestId("col-preparing").locator('[data-number="1012"]');
  await ready.getByTestId("order-action").click();
  await page.getByTestId("col-ready").locator('[data-number="1012"]').getByTestId("order-action").click();
  await expect(page.getByTestId("done-order")).toHaveCount(2);
  await expect(page.getByTestId("done-order").first()).toContainText("#1012");

  await page.getByTestId("done-order").first().getByRole("button", { name: "Undo" }).click();
  await expect(page.getByTestId("col-ready").locator('[data-number="1012"]')).toBeVisible();
});
