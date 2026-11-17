/**
 * Performance budgets that can't drift back (2026-11-18). Each check counts work rather than timing it, so it holds on
 * any CI machine:
 * - switching to Motion and back fires at most a couple of window `resize` events (the panel spring used to fire one
 *   per frame, waking every resize listener in the editor);
 * - duplicating a layer measures the page a bounded number of times (it used to measure after every stage render);
 * - after editing one layer, Play re-samples only that layer's animation, not every animated layer;
 * - no stylesheet keys page-wide rules off `html:has(...)`, which restyled the whole editor on every DOM insertion.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Counters = { stageMeasure: number; reset: () => void };
const commits = (page: Page) => page.evaluate(() => (window as unknown as { __LL_COMMITS__: Counters }).__LL_COMMITS__.stageMeasure);
const resetCommits = (page: Page) => page.evaluate(() => (window as unknown as { __LL_COMMITS__: Counters }).__LL_COMMITS__.reset());
const samples = (page: Page) => page.evaluate(() => (window as unknown as { __LL_WAAPI__?: { samples: number } }).__LL_WAAPI__?.samples ?? -1);
const twoFrames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __LL_TEST__: boolean; __RESIZES__: number };
    w.__LL_TEST__ = true;
    w.__RESIZES__ = 0;
    window.addEventListener("resize", () => {
      w.__RESIZES__++;
    });
  });
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test("switching to Motion and back doesn't fire a window resize per animation frame", async ({ page }) => {
  await page.evaluate(() => ((window as unknown as { __RESIZES__: number }).__RESIZES__ = 0));
  await page.getByRole("tab", { name: "Motion" }).click();
  await expect(page.getByRole("toolbar", { name: "Timeline header" })).toBeVisible();
  await page.waitForTimeout(1200); // past the panel spring
  await page.getByRole("tab", { name: "Design" }).click();
  await page.waitForTimeout(1200);
  const resizes = await page.evaluate(() => (window as unknown as { __RESIZES__: number }).__RESIZES__);
  console.log(`mode switch there and back: ${resizes} window resize events`);
  expect(resizes, "one announcement per settled layout, not one per frame").toBeLessThanOrEqual(6);
});

test("duplicating a layer measures the page a bounded number of times", async ({ page }) => {
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  await resetCommits(page);
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Control+d");
    await twoFrames(page);
  }
  await page.waitForTimeout(300);
  const measures = await commits(page);
  console.log(`5 duplicates: ${measures} page measurements`);
  expect(measures, "about one measurement per edit").toBeLessThanOrEqual(15);
});

test("after editing one layer, Play re-samples that layer only", async ({ page }) => {
  // a page with ten animated copies of the headline
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  for (let i = 0; i < 9; i++) {
    await page.keyboard.press("Control+d");
    await twoFrames(page);
  }
  await page.getByRole("tab", { name: "Motion" }).click();
  const bar = page.getByRole("toolbar", { name: "Timeline header" });
  await expect(bar).toBeVisible();
  // bake everything once
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await page.waitForTimeout(300);
  await bar.getByRole("button", { name: "Pause (Space)", exact: true }).click();
  expect(await samples(page), "every animated copy was sampled once").toBeGreaterThanOrEqual(10);

  // edit one layer (nudge the selected copy), then play again
  await page.getByRole("tab", { name: "Design" }).click();
  await page.waitForTimeout(500);
  const before = await samples(page);
  // the canvas takes the arrow keys while the pointer is over it
  const art = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(art.x + art.width - 20, art.y + art.height - 20);
  await page.keyboard.press("ArrowRight");
  await twoFrames(page);
  await page.getByRole("tab", { name: "Motion" }).click();
  await expect(bar).toBeVisible();
  await bar.getByRole("button", { name: "Play (Space)", exact: true }).click();
  await page.waitForTimeout(300);
  const resampled = (await samples(page)) - before;
  console.log(`Play after a one-layer edit re-sampled ${resampled} layer(s)`);
  expect(resampled, "the edited layer was re-sampled").toBeGreaterThanOrEqual(1);
  expect(resampled, "only the edited layer (and nothing that didn't change)").toBeLessThanOrEqual(2);
});

test("no stylesheet keys rules off html:has(...)", async ({ page }) => {
  const offenders = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if (rule instanceof CSSStyleRule && /(^|,\s*)html:has\(/.test(rule.selectorText)) out.push(rule.selectorText);
        const nested = (rule as CSSGroupingRule).cssRules;
        if (nested) walk(nested);
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walk(sheet.cssRules);
      } catch {
        /* cross-origin sheet */
      }
    }
    return out;
  });
  expect(offenders, "html:has() re-matches the whole page on every DOM insertion").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.classList.contains("ll-ui"))).toBe(true);
});
