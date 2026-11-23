import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const STAFF_SPECS = [/kitchen\.spec/, /admin\.spec/];

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
  },
  // Customers mostly order on phones: test Android (Chrome) and iPhone (Safari engine), plus a desktop browser.
  // Staff screens (kitchen tablet, admin, driver) run on Chrome only.
  projects: [
    { name: "pixel", use: { ...devices["Pixel 7"], launchOptions: localChromium ? { executablePath: localChromium } : {} } },
    { name: "iphone", use: { ...devices["iPhone 14"] }, testIgnore: STAFF_SPECS },
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: localChromium ? { executablePath: localChromium } : {} } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start --port ${port}`, port, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
