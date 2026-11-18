import { defineConfig } from "@playwright/test";

/**
 * Performance probes: measure, don't assert. Not part of the test suite (the budgets that are asserted live in
 * tests/e2e/editor-perf-budget.spec.ts). Needs a running production build (PW_BASE_URL or :3000).
 *
 *   npm run perf:probe                      # numbers at full speed
 *   CPU_THROTTLE=4 npm run perf:probe       # a mid-range laptop
 *   PROFILE_DIR=out npm run perf:profile    # CPU profiles + traces; build with LL_PROFILE_MAPS=1 to map them to source
 */
export default defineConfig({
  testDir: "./tests/perf",
  testMatch: "*.spec.ts",
  timeout: 5 * 60_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PW_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1600, height: 1000 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
