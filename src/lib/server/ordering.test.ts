import { afterEach, describe, expect, it, vi } from "vitest";
import { orderingOpen } from "./ordering";

const before = new Date("2026-12-01T12:00:00Z");
const after = new Date("2026-12-10T12:00:00Z");

describe("orderingOpen", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps the live site closed before opening day", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(orderingOpen(before)).toBe(false);
    expect(orderingOpen(after)).toBe(true);
  });

  it("lets the owner's staff test mode order on the live site before opening day", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(orderingOpen(before, true, true)).toBe(true);
  });

  it("never overrides a paused shop", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(orderingOpen(after, false, true)).toBe(false);
  });

  it("previews take test orders any day", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(orderingOpen(before)).toBe(true);
  });
});
