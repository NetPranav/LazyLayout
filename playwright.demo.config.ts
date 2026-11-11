import { defineConfig } from "@playwright/test";

/**
 * Demo runs: a visible, slowed-down browser that builds something step by step with View > Show keystrokes on, so a
 * person can watch how it is made. Not part of the test suite (`npm run demo`; needs a running editor, PW_BASE_URL or :3000).
 * SLOWMO sets the pause between actions in ms (default 450).
 */
export default defineConfig({
  testDir: "./tests/demo",
  testMatch: "*.demo.ts",
  timeout: 10 * 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:3000",
    headless: false,
    viewport: { width: 1600, height: 1000 },
    launchOptions: { slowMo: Number(process.env.SLOWMO ?? 450) },
    video: process.env.RECORD ? "on" : "off",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
