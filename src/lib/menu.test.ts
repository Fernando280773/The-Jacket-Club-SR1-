import { describe, expect, it } from "vitest";
import { e2eFullMenu } from "./menu";

describe("e2eFullMenu (browser tests ignore live sold-out state)", () => {
  it("is off unless the test run asks for it", () => {
    expect(e2eFullMenu({})).toBe(false);
    expect(e2eFullMenu({ E2E_FULL_MENU: "0" })).toBe(false);
  });

  it("is on for a test run", () => {
    expect(e2eFullMenu({ E2E_FULL_MENU: "1" })).toBe(true);
    expect(e2eFullMenu({ E2E_FULL_MENU: "1", VERCEL_ENV: "preview" })).toBe(true);
  });

  it("is never on for the live site", () => {
    expect(e2eFullMenu({ E2E_FULL_MENU: "1", VERCEL_ENV: "production" })).toBe(false);
  });
});
