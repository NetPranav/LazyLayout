/**
 * Performance probe (not a gate): long tasks while the editor loads, the first and second time Motion opens,
 * while layers are added, and during playback. Prints numbers; asserts nothing. Run:
 *   npm run perf:probe   (CPU_THROTTLE=4 for a mid-range laptop; see playwright.perf.config.ts)
 */
import { test, type Page } from "@playwright/test";
import { openEditor } from "../e2e/support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });
test.setTimeout(240_000);

type LT = { count: number; total: number; max: number };

async function installLongTasks(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __LT__: number[]; __LL_TEST__: boolean };
    w.__LL_TEST__ = true;
    w.__LT__ = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) w.__LT__.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
  });
}
const takeLongTasks = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __LT__: number[] };
    const d = w.__LT__.splice(0);
    return { count: d.length, total: Math.round(d.reduce((a, b) => a + b, 0)), max: Math.round(Math.max(0, ...d)) } as LT;
  });
const settle = (page: Page, ms: number) => page.waitForTimeout(ms);
const framesDuring = (page: Page, ms: number) =>
  page.evaluate((ms) => new Promise<{ frames: number; worstMs: number }>((resolve) => {
    let frames = 0;
    let last = performance.now();
    let worst = 0;
    const start = last;
    const tick = (now: number) => {
      frames++;
      worst = Math.max(worst, now - last);
      last = now;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve({ frames, worstMs: Math.round(worst) });
    };
    requestAnimationFrame(tick);
  }), ms);

test("perf probe", async ({ page }) => {
  await installLongTasks(page);
  const rate = Number(process.env.CPU_THROTTLE ?? 1);
  if (rate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }
  const t0 = Date.now();
  await openEditor(page);
  await page.locator("[data-stage=artboard]").waitFor();
  const loadMs = Date.now() - t0;
  await settle(page, 1500);
  const load = await takeLongTasks(page);

  const t1 = Date.now();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.getByRole("toolbar", { name: "Timeline header" }).waitFor();
  const motion1Ms = Date.now() - t1;
  await settle(page, 1500);
  const motion1 = await takeLongTasks(page);

  await page.getByRole("tab", { name: "Design" }).click();
  await settle(page, 800);
  await takeLongTasks(page);
  const t2 = Date.now();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.getByRole("toolbar", { name: "Timeline header" }).waitFor();
  const motion2Ms = Date.now() - t2;
  await settle(page, 1500);
  const motion2 = await takeLongTasks(page);

  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  const play = await framesDuring(page, 2000);
  const playLT = await takeLongTasks(page);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();

  // Design: draw 30 rectangles, timing each
  await page.getByRole("tab", { name: "Design" }).click();
  await settle(page, 800);
  await takeLongTasks(page);
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const addTimes: number[] = [];
  for (let i = 0; i < 30; i++) {
    const x = art.x + 60 + (i % 6) * 70;
    const y = art.y + 120 + Math.floor(i / 6) * 60;
    await page.keyboard.press("r");
    const ta = Date.now();
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 30, { steps: 4 });
    await page.mouse.up();
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    addTimes.push(Date.now() - ta);
  }
  const adds = await takeLongTasks(page);
  const drag = await (async () => {
    const x = art.x + 80, y = art.y + 135;
    await page.mouse.move(x, y);
    await page.mouse.down();
    const p = framesDuring(page, 1000);
    for (let i = 0; i < 30; i++) await page.mouse.move(x + i * 4, y + i * 2);
    const r = await p;
    await page.mouse.up();
    return r;
  })();
  const dragLT = await takeLongTasks(page);


  const sorted = [...addTimes].sort((a, b) => a - b);
  console.log(JSON.stringify({
    loadMs, load,
    motionFirst: { ms: motion1Ms, ...motion1 },
    motionSecond: { ms: motion2Ms, ...motion2 },
    playback2s: { ...play, ...playLT },
    add30: { medianMs: sorted[15], maxMs: sorted[29], firstMs: addTimes[0], lastMs: addTimes[29], ...adds },
    dragWith30: { ...drag, ...dragLT },
  }, null, 1));
});

test("perf probe: heavy animated scene", async ({ page }) => {
  await installLongTasks(page);
  const rate = Number(process.env.CPU_THROTTLE ?? 1);
  if (rate > 1) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  }
  await openEditor(page);
  await page.locator("[data-stage=artboard]").waitFor();
  await settle(page, 1500);
  await takeLongTasks(page);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  const dupTimes: number[] = [];
  for (let i = 0; i < 40; i++) {
    const t = Date.now();
    await page.keyboard.press("Control+d");
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    dupTimes.push(Date.now() - t);
  }
  await settle(page, 1000);
  const dupLT = await takeLongTasks(page);
  const layerCount = await page.locator('[data-testid="stage-page"] [data-archetype]').count();
  const t1 = Date.now();
  await page.getByRole("tab", { name: "Motion" }).click();
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await bar.waitFor();
  const openMs = Date.now() - t1;
  await settle(page, 1000);
  const openLT = await takeLongTasks(page);
  await page.evaluate(() => (window as unknown as { __LL_COMMITS__: { reset: () => void } }).__LL_COMMITS__.reset());
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  const play = await framesDuring(page, 2000);
  const playLT = await takeLongTasks(page);
  const commits = await page.evaluate(() => {
    const c = (window as unknown as { __LL_COMMITS__: Record<string, unknown> }).__LL_COMMITS__;
    return Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === "number"));
  });
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  const sorted = [...dupTimes].sort((a, b) => a - b);
  console.log(JSON.stringify({ heavy: { layerCount, duplicate40: { medianMs: sorted[20], maxMs: sorted[39], lastMs: dupTimes[39], ...dupLT }, motionOpen: { ms: openMs, ...openLT }, play2s: { ...play, ...playLT, commits } } }));
});
