import { describe, expect, it } from "vitest";
import { siteOrigin } from "./site-origin";

describe("siteOrigin", () => {
  it("uses the public address from the proxy, not the internal one", () => {
    const req = new Request("https://localhost:3011/api/stripe/webhook", {
      headers: { "x-forwarded-host": "www.thejacketclubsr1.com", "x-forwarded-proto": "https", host: "127.0.0.1:3011" },
    });
    expect(siteOrigin(req)).toBe("https://www.thejacketclubsr1.com");
  });

  it("falls back to the host header and https", () => {
    const req = new Request("http://localhost:3011/x", { headers: { host: "www.thejacketclubsr1.com" } });
    expect(siteOrigin(req)).toBe("https://www.thejacketclubsr1.com");
  });

  it("falls back to the request address when there are no headers", () => {
    expect(siteOrigin(new Request("https://example.test/x"))).toBe("https://example.test");
  });
});
