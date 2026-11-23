import { expect, test } from "@playwright/test";

test("the driver page asks for a login", async ({ page }) => {
  await page.goto("/driver");
  await expect(page.getByTestId("staff-login")).toHaveText("Driver sign in");
});

test("choosing Delivery asks for an address and blocks checkout until one is chosen", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="item-card"][data-code="J01"]').getByRole("button").click();
  await page.getByTestId("add-to-basket").click();
  await page.getByTestId("basket-bar").click();
  await page.getByRole("radio", { name: "Delivery" }).click();
  await expect(page.getByTestId("address-search")).toBeVisible();
  await expect(page.getByTestId("delivery-blocked")).toBeDisabled();
  await expect(page.getByTestId("go-to-checkout")).toHaveCount(0);
});

test("a driver sees their deliveries with Navigate, Call and Picked up", async ({ page }) => {
  await page.addInitScript(() => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem(
      "jc-staff-auth",
      JSON.stringify({ access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: "00000000-0000-4000-8000-000000000003", aud: "authenticated", role: "authenticated", email: "d@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }),
    );
  });
  const calls: unknown[] = [];
  const order = {
    id: "o1",
    number: 1020,
    status: "ready",
    pickup_at: new Date(Date.now() + 30 * 60_000).toISOString(),
    customer_name: "Sam Smith",
    customer_phone: "+447700900123",
    updated_at: new Date().toISOString(),
    deliveries: { address_text: "1 High Street, Sunderland SR1 1AA", postcode: "SR1 1AA", note: "Flat 2, side door", latitude: 54.9, longitude: -1.38, distance_miles: 1.4 },
    order_lines: [{ id: "l1", item_name: "The Classic", quantity: 2, order_line_options: [] }],
  };
  await page.route("**/rest/v1/staff_users*", (r) => r.fulfill({ json: { shop_id: "s1", name: "Dave", role: "driver", is_active: true } }));
  await page.route("**/rest/v1/orders*", (r) => r.fulfill({ json: [order] }));
  await page.route("**/rest/v1/rpc/driver_set_status", async (r) => {
    const body = r.request().postDataJSON() as { p_to: string };
    calls.push(body);
    order.status = body.p_to;
    await r.fulfill({ json: body.p_to });
  });

  await page.goto("/driver");
  const card = page.getByTestId("driver-order");
  await expect(card).toHaveCount(1);
  await expect(card).toContainText("1 High Street, Sunderland SR1 1AA");
  await expect(card).toContainText("Flat 2, side door");
  await expect(card.getByRole("link", { name: "Navigate" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  await expect(card.getByRole("link", { name: "Call customer" })).toHaveAttribute("href", "tel:+447700900123");

  await card.getByTestId("driver-picked-up").click();
  await expect(card.getByTestId("driver-delivered")).toBeVisible();
  await card.getByTestId("driver-delivered").click();
  await expect.poll(() => calls).toEqual([
    { p_order_id: "o1", p_to: "out_for_delivery" },
    { p_order_id: "o1", p_to: "delivered" },
  ]);
});
