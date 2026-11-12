/**
 * ROADMAP_3D 3D-006: the worker job pool on /editor/gpu-lab and cloth on /editor/surface-lab.
 * - Heavy compute runs in workers off the main thread; main thread ticks freely.
 * - Cancelling terminates the busy worker and respawns it promptly.
 * - Cloth simulation completes in a worker and updates surface state to "cloth".
 */
import { test, expect, type Page } from "@playwright/test";

type JobResult = { state: "pending" | "done" | "cancelled" | "error"; value?: unknown };
type JobsApi = {
  run: (kind: string, payload: unknown, opts?: unknown) => number;
  cancel: (id: number) => void;
  result: (id: number) => JobResult;
  stats: () => { workers: number; busy: number; queued: number; completed: number; cancelled: number; cacheHits: number; respawns: number };
  mainThreadTicks: () => number;
};
type Win = { __LL_JOBS__?: JobsApi };

async function openJobsLab(page: Page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/editor/gpu-lab?surfaces=0&scenes=0", { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_JOBS__);
}

test("3D-006: a 5000 ms test.burn job leaves the main thread free to tick", async ({ page }) => {
  await openJobsLab(page);
  const id = await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.run("test.burn", { ms: 5000 }));
  const ticks0 = await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.mainThreadTicks());
  await page.waitForTimeout(3000);
  await expect.poll(
    async () => (await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.mainThreadTicks())) - ticks0,
    { timeout: 1000 },
  ).toBeGreaterThanOrEqual(300);
  const res = await page.evaluate((id) => (window as unknown as Win).__LL_JOBS__!.result(id), id);
  expect(res.state, "burn job is still running while ticks grew").toBe("pending");
});

test("3D-006: cancelling a running job marks it cancelled within 500 ms and respawns the worker", async ({ page }) => {
  await openJobsLab(page);
  const id1 = await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.run("test.burn", { ms: 5000 }));
  await page.evaluate((id) => (window as unknown as Win).__LL_JOBS__!.cancel(id), id1);
  await expect.poll(
    async () => (await page.evaluate((id) => (window as unknown as Win).__LL_JOBS__!.result(id), id1)).state,
    { timeout: 500 },
  ).toBe("cancelled");

  // fresh job runs on the respawned worker
  const id2 = await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.run("test.burn", { ms: 50 }));
  await expect.poll(
    async () => (await page.evaluate((id2) => (window as unknown as Win).__LL_JOBS__!.result(id2), id2)).state,
    { timeout: 5000 },
  ).toBe("done");
  const stats = await page.evaluate(() => (window as unknown as Win).__LL_JOBS__!.stats());
  expect(stats.respawns, "worker pool respawned the terminated worker").toBeGreaterThanOrEqual(1);
});

test("3D-006: cloth simulation completes on surface-lab within 30 s", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/editor/surface-lab", { waitUntil: "load" });
  const cloth = page.locator('[data-surface-state="cloth"]');
  await expect(cloth).toBeAttached({ timeout: 30_000 });
  await expect(cloth).toBeVisible();
});
