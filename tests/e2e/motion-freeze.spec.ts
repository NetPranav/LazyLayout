/**
 * The editor froze ("page not responding") as soon as anything was animated: opening Motion, playing, previewing.
 * The canvas watched the page for style changes and measured it again on each one, and every measurement rests the
 * animation (writing styles) and puts it back (writing them again), so it set itself off without end. These check
 * that Motion opens and plays with the page still answering, that playback doesn't make the canvas measure the page
 * every frame, and that the canvas still follows a layer whose drawn box changes with no document change.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Counters = { timeline: number; artboard: number; stageMeasure: number; reset: () => void };

/** True when the page runs a script within `ms`: a frozen page never does. */
const answers = (page: Page, ms = 3000) =>
  Promise.race([page.evaluate(() => true), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), ms))]);

const counters = (page: Page) => page.evaluate(() => {
  const c = (window as unknown as { __LL_COMMITS__?: Counters }).__LL_COMMITS__;
  return c ? { artboard: c.artboard, stageMeasure: c.stageMeasure } : null;
});

/** Frames painted during `ms` of wall time. */
const framesDuring = (page: Page, ms: number) =>
  page.evaluate((ms) => new Promise<number>((resolve) => {
    let frames = 0;
    const start = performance.now();
    const tick = () => {
      frames++;
      if (performance.now() - start < ms) requestAnimationFrame(tick);
      else resolve(frames);
    };
    requestAnimationFrame(tick);
  }), ms);

async function boxesOf(page: Page, id: string) {
  const hit = await page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`).boundingBox();
  const drawn = await page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).boundingBox();
  return { hit, drawn };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test("Motion opens and plays an animated page with the page still answering, and playback doesn't re-measure it every frame", async ({ page }) => {
  await page.getByRole("tab", { name: "Motion" }).click();
  expect(await answers(page), "the page answers after Motion opens").toBe(true);
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Go to start (Home)" }).click();

  await page.evaluate(() => (window as unknown as { __LL_COMMITS__: Counters }).__LL_COMMITS__.reset());
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await expect(bar.getByRole("button", { name: "Pause (Space)", exact: true })).toBeVisible();
  const frames = await framesDuring(page, 1000);
  const during = await counters(page);
  expect(await answers(page), "the page answers while playing").toBe(true);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();

  console.log(`1s of playback: ${frames} frames painted, ${during?.stageMeasure} page measurements, ${during?.artboard} artboard commits`);
  expect(frames, "the page keeps painting while it plays").toBeGreaterThan(10);
  // the engine's own writes move the animated pose, never where a layer rests: they are not measured
  expect(during?.stageMeasure, "the canvas doesn't measure the page on every frame of playback").toBeLessThanOrEqual(10);

  // Motion shows the page in Preview: hovering it runs states and drivers, and the page still answers
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  for (let i = 0; i < 30; i++) await page.mouse.move(art.x + 40 + ((i * 37) % 400), art.y + 60 + ((i * 23) % 300));
  expect(await answers(page), "the page answers while the pointer moves over the preview").toBe(true);

  // back in Design, the canvas still measures: the headline's selection box sits on the drawn headline
  await page.getByRole("tab", { name: "Design" }).click();
  expect(await answers(page)).toBe(true);
  await expect.poll(async () => {
    const { hit, drawn } = await boxesOf(page, "headline");
    return hit && drawn ? Math.max(Math.abs(hit.x - drawn.x), Math.abs(hit.y - drawn.y), Math.abs(hit.width - drawn.width), Math.abs(hit.height - drawn.height)) : 999;
  }).toBeLessThanOrEqual(2);
});

test("the canvas follows a layer whose drawn box changes with no document change", async ({ page }) => {
  const before = await boxesOf(page, "headline");
  expect(before.hit && before.drawn).toBeTruthy();
  // what a picture arriving, a font swapping or a class changing does: the page changes, the document doesn't
  await page.locator('[data-testid="stage-page"] [data-archetype][data-element-id="headline"]').evaluate((el, w) => {
    (el as HTMLElement).style.width = `${w}px`;
  }, Math.round(before.drawn!.width / 2));
  await expect.poll(async () => {
    const { hit, drawn } = await boxesOf(page, "headline");
    return hit && drawn ? Math.abs(hit.width - drawn.width) : 999;
  }, { message: "the hit box takes the drawn width" }).toBeLessThanOrEqual(2);
  const after = await boxesOf(page, "headline");
  expect(after.drawn!.width).toBeLessThan(before.drawn!.width - 10);
  expect(await answers(page)).toBe(true);
});
