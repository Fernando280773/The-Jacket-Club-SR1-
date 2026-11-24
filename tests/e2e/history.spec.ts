import { expect, test, type Page } from "@playwright/test";

// Fakes Supabase in the browser: no real orders are read or changed.
const USER_ID = "00000000-0000-4000-8000-000000000002";
const SHOP_ID = "00000000-0000-4000-8000-0000000000aa";

async function fakeStaff(page: Page, role: "owner" | "kitchen") {
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  const now = new Date();
  const issues: unknown[] = [];
  const row = (id: string, number: number, type: string, status: string, name: string, phone: string, extra = {}) => ({
    id, number, type, status, created_at: now.toISOString(), pickup_at: null, total_pence: 1250, is_staff_test: false,
    customer_name: name, phone, table_number: type === "table" ? 4 : null, issue_count: 0, ...extra,
  });
  await page.addInitScript(([userId]) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    localStorage.setItem("jc-staff-auth", JSON.stringify({ access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: userId, aud: "authenticated", role: "authenticated", email: "x@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() } }));
  }, [USER_ID]);
  await page.route("**/rest/v1/staff_users*", (r) => r.fulfill({ json: { shop_id: SHOP_ID, name: role === "owner" ? "Antony" : "Kitchen tablet", role, is_active: true } }));
  await page.route("**/rest/v1/orders*", (r) => r.fulfill({ json: [] }));
  await page.route("**/rest/v1/shop_settings*", (r) => r.fulfill({ json: { is_accepting_orders: true, paused_message: null } }));
  await page.route("**/api/staff/test-mode", (r) => r.fulfill({ json: { on: false } }));
  await page.route("**/rest/v1/rpc/*", async (r) => {
    const name = new URL(r.request().url()).pathname.split("/").pop()!;
    const body = (r.request().postDataJSON() ?? {}) as Record<string, unknown>;
    calls.push({ name, body });
    if (name === "staff_order_history") {
      const all = [
        row("o2", 1021, "delivery", "delivered", role === "owner" ? "Sam Smith" : "Sam", role === "owner" ? "+447700900123" : "0123"),
        row("o1", 1020, "table", "collected", role === "owner" ? "Ali Khan" : "Ali", role === "owner" ? "+447700900456" : "0456", { issue_count: issues.length }),
      ];
      const q = String(body.p_search ?? "");
      const orders = q ? all.filter((o) => String(o.number) === q || o.customer_name.toLowerCase().includes(q.toLowerCase()) || o.phone.endsWith(q)) : all;
      return r.fulfill({ json: { from: body.p_from, to: body.p_to, owner: role === "owner", orders } });
    }
    if (name === "staff_order_detail") {
      return r.fulfill({ json: {
        id: "o1", number: 1020, type: "table", status: "collected", created_at: now.toISOString(), pickup_at: null, note: null, is_staff_test: false,
        subtotal_pence: 1250, delivery_fee_pence: 0, deposit_credit_pence: 0, total_pence: 1250, owner: role === "owner",
        customer_name: role === "owner" ? "Ali Khan" : "Ali", phone: role === "owner" ? "+447700900456" : "0456", has_email: true, table_number: 4,
        lines: [
          { item_name: "The Classic", quantity: 1, line_total_pence: 550, options: [{ group_name: "Extras", option_name: "Cheese", count: 1 }] },
          { item_name: "Skin-on Fries", quantity: 2, line_total_pence: 700, options: [] },
        ],
        events: [
          { from_status: null, to_status: "received", at: now.toISOString(), staff: null },
          { from_status: "received", to_status: "preparing", at: now.toISOString(), staff: "Kitchen tablet" },
        ],
        delivery: null,
        issues,
      } });
    }
    if (name === "report_order_issue") {
      issues.push({ kind: body.p_kind, item_names: body.p_item_names, note: body.p_note, action: body.p_action, refund_pence: body.p_refund_pence, staff: "Kitchen tablet", at: now.toISOString() });
      return r.fulfill({ json: "00000000-0000-4000-8000-0000000000ff" });
    }
    if (name === "order_issue_summary") return r.fulfill({ json: { missing_item: 2, cold: 1 } });
    return r.fulfill({ json: null });
  });
  return { calls };
}

test("kitchen finds an order by phone ending and sees only the first name", async ({ page }) => {
  const { calls } = await fakeStaff(page, "kitchen");
  await page.goto("/admin?tab=history");
  await expect(page.getByTestId("history-row")).toHaveCount(2);
  await expect(page.getByTestId("history-row").first()).toContainText("Sam");
  await expect(page.getByTestId("history-row").first()).toContainText("…0123");
  await expect(page.getByTestId("history-row").first()).not.toContainText("+44");
  await expect(page.getByTestId("issue-summary")).toHaveCount(0); // owner only

  await page.getByTestId("history-search").fill("0456");
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  await expect(page.getByTestId("history-row")).toHaveAttribute("data-number", "1020");
  const last = calls.filter((c) => c.name === "staff_order_history").at(-1)!;
  expect(last.body.p_search).toBe("0456");
});

test("staff report a missing item and the order shows the problem", async ({ page }) => {
  const { calls } = await fakeStaff(page, "kitchen");
  await page.goto("/admin?tab=history");
  await page.locator('[data-testid="history-row"][data-number="1020"]').click();
  await expect(page.getByTestId("order-detail")).toContainText("#1020 · Table 4");
  await expect(page.getByTestId("order-timeline")).toContainText("Kitchen tablet");

  await page.getByTestId("report-problem").click();
  // Missing item needs the item ticked.
  await page.getByTestId("save-issue").click();
  await expect(page.getByTestId("report-form").getByRole("alert")).toContainText("Tick which item");
  await page.getByTestId("report-form").getByLabel("Skin-on Fries").check();
  await page.getByText("Refunded (in Stripe)").click();
  await page.getByTestId("issue-refund").fill("3.50");
  await page.getByTestId("save-issue").click();
  await expect(page.getByTestId("issue")).toContainText("Missing item: Skin-on Fries");
  await expect(page.getByTestId("issue")).toContainText("£3.50");
  const saved = calls.find((c) => c.name === "report_order_issue")!;
  expect(saved.body).toMatchObject({ p_order_id: "o1", p_kind: "missing_item", p_item_names: ["Skin-on Fries"], p_action: "refunded", p_refund_pence: 350 });

  await page.getByTestId("history-back").click();
  await expect(page.locator('[data-testid="history-row"][data-number="1020"]').getByTestId("problem-tag")).toBeVisible();
});

test("the owner sees full phone numbers and the weekly problem count", async ({ page }) => {
  await fakeStaff(page, "owner");
  await page.goto("/admin?tab=history");
  await expect(page.getByTestId("issue-summary")).toContainText("Problems in the last 7 days: 3");
  await expect(page.getByTestId("issue-summary")).toContainText("Missing item 2");
  await expect(page.getByTestId("history-row").first()).toContainText("+447700900123");
});

test("resend receipt refuses a request with no login", async ({ request }) => {
  expect((await request.post("/api/staff/resend-receipt", { data: { orderId: "00000000-0000-4000-8000-000000000001" } })).status()).toBe(401);
});
