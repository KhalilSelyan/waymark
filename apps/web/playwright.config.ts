import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:5180", trace: "retain-on-failure" },
  webServer: { command: "WAYMARK_E2E=true pnpm --filter web dev --host 127.0.0.1 --port 5180", url: "http://127.0.0.1:5180", reuseExistingServer: false, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
