/**
 * ROADMAP_3D 3D-002: the GPU compositor (decision 0011) on /editor/gpu-lab.
 * - 20 surfaces share one context; 10 scenes get at most `budget` contexts; the browser never warns about too many.
 * - A scene scrolled out of view sleeps and shows its last frame; scrolled back, it gets a context again.
 * - A lost context (shared or a scene's) is recovered within 1 s.
 */
import { test, expect, type Page } from "@playwright/test";

type Stats = { contexts: number; scenes: number; awake: number; asleep: number; waiting: number; losses: number; restores: number };
type Win = { __LL_GPU__?: { stats: () => Stats; loseShared: () => void; restoreShared: () => void } };
const stats = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_GPU__!.stats());

async function open(page: Page, warnings: string[]) {
  page.on("console", (m) => {
    if (/too many active webgl contexts/i.test(m.text())) warnings.push(m.text());
  });
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/editor/gpu-lab?surfaces=20&scenes=10&budget=6", { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_GPU__);
  // every surface drew (its canvas has a size)
  await expect.poll(() => page.locator('[data-surface-canvas]').evaluateAll((cs) => cs.filter((c) => (c as HTMLCanvasElement).width > 10).length), { timeout: 30_000 }).toBe(20);
}

/** The colour at the middle of a canvas, read through a 2D copy (works for WebGL and 2D canvases). */
const middle = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    const ctx = copy.getContext("2d")!;
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  });

test("3D-002: 20 surfaces and 10 scenes stay within the context budget", async ({ page }) => {
  const warnings: string[] = [];
  await open(page, warnings);
  await expect.poll(async () => (await stats(page)).scenes).toBe(10);
  const s = await stats(page);
  expect(s.awake, "at most the budget of scenes hold a context").toBeLessThanOrEqual(6);
  expect(s.contexts, "the shared surface context plus the scene budget").toBeLessThanOrEqual(7);
  expect(s.awake + s.waiting + s.asleep).toBe(10);
  expect(warnings).toEqual([]);
});

test("3D-002: a scene out of view sleeps with its last frame; back in view it wakes", async ({ page }) => {
  await open(page, []);
  await expect.poll(async () => (await stats(page)).awake).toBeGreaterThan(0);
  // a scene that got a context (only `budget` of the 10 do)
  const awake = await page.locator("[data-test-scene]").evaluateAll((els) => els.find((e) => e.querySelector("canvas")!.dataset.ready)!.getAttribute("data-test-scene"));
  const before = await middle(page, `[data-test-scene="${awake}"] canvas:not([data-poster])`);
  expect(before[3], `scene ${awake} drew`).toBe(255);
  await page.getByTestId("gpu-lab-scroll").evaluate((el) => el.scrollTo(0, 2500));
  await expect.poll(async () => (await stats(page)).awake, { message: "every scene is asleep off screen" }).toBe(0);
  const poster = await middle(page, `[data-test-scene="${awake}"] canvas[data-poster]`);
  expect(poster, "the poster shows the last frame").toEqual(before);
  await page.getByTestId("gpu-lab-scroll").evaluate((el) => el.scrollTo(0, 0));
  await expect.poll(async () => (await stats(page)).awake).toBeGreaterThan(0);
  await expect.poll(async () => (await stats(page)).contexts).toBeLessThanOrEqual(7);
});

test("3D-002: a lost context comes back within a second, and surfaces draw again", async ({ page }) => {
  await open(page, []);
  // the shared surface context
  await page.evaluate(() => (window as unknown as Win).__LL_GPU__!.loseShared());
  await expect.poll(async () => (await stats(page)).losses).toBeGreaterThanOrEqual(1);
  const t0 = Date.now();
  await page.evaluate(() => (window as unknown as Win).__LL_GPU__!.restoreShared());
  await expect.poll(async () => (await stats(page)).restores, { timeout: 1000 }).toBeGreaterThanOrEqual(1);
  expect(Date.now() - t0).toBeLessThan(1000);
  // a press redraws a surface on the new context (its textures uploaded again)
  const box = (await page.locator('[data-element-id="s0"]').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await expect.poll(async () => (await middle(page, '[data-element-id="s0"] [data-surface-canvas]'))[3], { message: "the surface is drawn" }).toBe(255);

  // a scene's context
  const sceneId = await page.locator("[data-test-scene]").evaluateAll((els) => els.find((e) => e.querySelector("canvas")!.dataset.ready)!.getAttribute("data-test-scene"));
  const sceneCanvas = page.locator(`[data-test-scene="${sceneId}"] canvas:not([data-poster])`);
  const ready = () => sceneCanvas.evaluate((c) => Number((c as HTMLCanvasElement).dataset.ready ?? "0"));
  const n = await ready();
  await sceneCanvas.evaluate((c) => {
    const ext = (c as HTMLCanvasElement).getContext("webgl2")!.getExtension("WEBGL_lose_context")!;
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 50);
  });
  await expect.poll(ready, { timeout: 1000, message: "the scene drew again after its context came back" }).toBeGreaterThan(n);
});

test("3D-003: mounting and unmounting 50 surfaces returns the memory ledger to the shared baseline", async ({ page }) => {
  type Led = { bytes: number; count: number; owners: Array<{ owner: string; count: number; bytes: number }> };
  const ledger = () => page.evaluate(() => (window as unknown as { __LL_GPU__: { ledger: () => Led } }).__LL_GPU__.ledger());
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/editor/gpu-lab?surfaces=0&scenes=0", { waitUntil: "load" });
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_GPU__);
  const set = (n: number) => page.evaluate((n) => (window as unknown as { __LL_GPU__: { setSurfaces: (n: number) => void } }).__LL_GPU__.setSurfaces(n), n);
  await set(1);
  await expect.poll(async () => (await ledger()).owners.some((o) => o.owner.startsWith("surface:") && o.owner !== "surface:shared"), { timeout: 30_000 }).toBe(true);
  await set(0);
  await expect.poll(async () => (await ledger()).owners.filter((o) => o.owner !== "surface:shared").length).toBe(0);
  const baseline = await ledger();
  for (let round = 0; round < 2; round++) {
    await set(50);
    await expect.poll(async () => (await ledger()).owners.filter((o) => o.owner !== "surface:shared").length, { timeout: 60_000 }).toBe(50);
    expect((await ledger()).bytes, "50 surfaces hold GPU memory").toBeGreaterThan(baseline.bytes);
    await set(0);
    await expect.poll(async () => (await ledger()).owners.filter((o) => o.owner !== "surface:shared").length, { timeout: 30_000 }).toBe(0);
    const after = await ledger();
    expect(after.bytes, "back to the shared baseline (the studio map)").toBe(baseline.bytes);
    expect(after.count).toBe(baseline.count);
  }
});
