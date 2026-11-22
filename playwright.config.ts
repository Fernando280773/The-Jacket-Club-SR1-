import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const localChromium = process.env.PLAYWRIGHT_CHROMIUM_PATH;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${port}`,
    ...devices["Pixel 7"],
    launchOptions: localChromium ? { executablePath: localChromium } : {},
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `pnpm start --port ${port}`, port, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
