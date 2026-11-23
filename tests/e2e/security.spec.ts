import { expect, test } from "@playwright/test";

test("every page sends the security headers", async ({ request }) => {
  for (const path of ["/", "/terms", "/kitchen", "/admin", "/driver"]) {
    const res = await request.get(path);
    const h = res.headers();
    expect(h["x-content-type-options"], path).toBe("nosniff");
    expect(h["x-frame-options"], path).toBe("DENY");
    expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    expect(h["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"], path).toContain("camera=()");
    expect(h["x-powered-by"], path).toBeUndefined();
  }
});

test("the Stripe webhook refuses an unsigned request", async ({ request }) => {
  const res = await request.post("/api/stripe/webhook", { data: { type: "checkout.session.completed" } });
  expect([400, 500]).toContain(res.status());
});

test("the staff APIs refuse a request with no login", async ({ request }) => {
  expect((await request.post("/api/admin/refresh")).status()).toBe(401);
  expect((await request.get("/api/staff/bookings?date=2026-12-10")).status()).toBe(401);
  expect((await request.post("/api/staff/bookings", { data: { action: "cancel", id: "x" } })).status()).toBe(401);
  // A forged login token is refused too.
  const forged = { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged" };
  expect((await request.post("/api/admin/refresh", { headers: forged })).status()).toBe(401);
});
