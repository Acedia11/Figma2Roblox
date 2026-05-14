import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./Tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixels: 0,
      threshold: 0,
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    colorScheme: "light",
    locale: "en-US",
  },
});
