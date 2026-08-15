import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
