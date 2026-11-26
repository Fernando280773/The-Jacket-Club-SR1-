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

test("staff test mode needs an owner login", async ({ request }) => {
  expect((await request.post("/api/staff/test-mode")).status()).toBe(401);
  expect((await request.post("/api/staff/test-mode", { headers: { Authorization: "Bearer forged.token.x" } })).status()).toBe(401);
  // A forged cookie does not turn it on either.
  const res = await request.get("/api/staff/test-mode", { headers: { Cookie: "jc_staff_test=forged.token.x" } });
  expect(await res.json()).toEqual({ on: false });
});

test("the test error alert needs an owner login", async ({ request }) => {
  expect((await request.post("/api/staff/sentry-test")).status()).toBe(401);
});

test("the label printer address refuses anyone who isn't the printer", async ({ request }) => {
  // No printer password on this server: closed (503). With one set: wrong sign-in is refused (401).
  for (const method of ["post", "get", "delete"] as const) {
    const res = await request[method]("/api/print/cloudprnt", { headers: { Authorization: `Basic ${Buffer.from("the-jacket-club-sr1:wrong-password-wrong").toString("base64")}` } });
    expect([401, 503], method).toContain(res.status());
  }
  expect([401, 503]).toContain((await request.post("/api/print/cloudprnt")).status());
});

test("the label preview needs a staff login, and the sample label draws", async ({ request }) => {
  expect((await request.get("/api/staff/label-preview")).status()).toBe(401);
  const sample = await request.get("/api/print/sample");
  expect(sample.status()).toBe(200);
  expect(sample.headers()["content-type"]).toBe("image/png");
  expect((await sample.body()).subarray(1, 4).toString()).toBe("PNG");
});
