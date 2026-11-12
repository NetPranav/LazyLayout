/**
 * ROADMAP_3D 3D-004: the GPU verification harness, on the surface lab (a quick-method surface: deterministic, no worker).
 * - The same scene at the same exact time gives the same picture twice (frame capture is deterministic).
 * - A golden image of the resting and the pressed button, through the comparison metrics.
 * - A deliberately wrong colour fails the comparison.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { compare } from "../../src/core/gpu/compare";
import { expectGolden } from "../support/golden";

type Lab = { deterministic: (on: boolean) => void; step: (dt: number) => void };
const QUERY = "s.surface.method=quick&s.surface.seed=3&s.surface.depth=40&s.surface.fullness=0.3";

async function open(page: Page, extra = "") {
  await page.setViewportSize({ width: 720, height: 720 });
  await page.goto(`/editor/surface-lab?${QUERY}${extra}`, { waitUntil: "load" });
  await page.waitForFunction(() => document.querySelector<HTMLCanvasElement>("[data-surface-canvas]")?.dataset.surfaceState === "quick" && !!(window as unknown as { __LL_SURFACE_LAB__?: unknown }).__LL_SURFACE_LAB__);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.evaluate(() => (window as unknown as { __LL_SURFACE_LAB__: Lab }).__LL_SURFACE_LAB__.deterministic(true));
}
const step = (page: Page, dt: number) => page.evaluate((dt) => (window as unknown as { __LL_SURFACE_LAB__: Lab }).__LL_SURFACE_LAB__.step(dt), dt);
const button = { x: 113, y: 258, width: 494, height: 220 };

/** The button pressed at its left third for 12 frames (0.2 s), captured at that exact time. */
async function pressedFrame(page: Page): Promise<Buffer> {
  await page.mouse.move(250, 340);
  await page.mouse.down();
  for (let i = 0; i < 12; i++) await step(page, 1 / 60);
  return page.screenshot({ clip: button });
}

test("3D-004: the same scene at the same time gives the same picture, twice", async ({ browser }) => {
  const shots: Buffer[] = [];
  for (let run = 0; run < 2; run++) {
    const page = await browser.newPage();
    await open(page);
    shots.push(await pressedFrame(page));
    await page.close();
  }
  const [a, b] = shots.map((s) => PNG.sync.read(s));
  const r = compare({ width: a.width, height: a.height, data: a.data }, { width: b.width, height: b.height, data: b.data }, { maxBadFraction: 0, minSsim: 0.9999, channelTolerance: 0, radius: 0 });
  expect(r.pass, `two runs differ in ${(r.badFraction * 100).toFixed(3)}% of pixels`).toBe(true);
});

test("3D-004: golden images of the resting and the pressed button", async ({ page }) => {
  await open(page);
  await expectGolden(page, "surface/button-rest", { clip: button });
  await pressedFrame(page);
  await expectGolden(page, "surface/button-pressed", { clip: button });
});

test("3D-004: a wrong look (red plastic for black foil) fails against the golden", async ({ page }) => {
  await open(page, "&s.appearance.background.color=%23c01010&s.surface.material=plastic");
  const golden = PNG.sync.read(readFileSync(resolveGolden("surface/button-rest")));
  const actual = PNG.sync.read(await page.screenshot({ clip: button }));
  const r = compare({ width: actual.width, height: actual.height, data: actual.data }, { width: golden.width, height: golden.height, data: golden.data });
  expect(r.pass, "a red plastic button is not the black foil one").toBe(false);
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const resolveGolden = (name: string) => resolve(__dirname, `../golden/${name}.png`);
