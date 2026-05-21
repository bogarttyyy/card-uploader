import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      testIgnore: /.*mobile\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "android-chrome",
      testMatch: /.*mobile\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        browserName: "chromium",
      },
    },
    {
      name: "ios-safari",
      testMatch: /.*mobile\.spec\.ts/,
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit",
      },
    },
  ],
});
