/**
 * ROADMAP Phase 74 gate: five compositing reference scenes, each seeked to five times, match what `evaluate()` says, in
 * the real stage (the dev page /editor/stage-lab) in every browser:
 *   blend      a multiplied layer: the computed blend mode and the pixel it makes
 *   isolation  an isolated group's computed isolation
 *   adjustment a blur from behind that grows: the computed backdrop filter equals the kernel's blur, and the edge softens
 *   alphaMask  an ellipse mask that grows: the mask image is the ellipse the kernel's width says, and the pixels follow
 *   lumaMorph  a luma mask whose path morphs: the mask image carries the kernel's path
 * Pixel colours are compared with a tolerance (rasterisers differ); the numbers are compared exactly.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { SCENE_BOX, SCENE_DIAMOND, SCENE_SQUARE, sceneId } from "../../src/legacy-editor/stage-lab/compositingScenes";

const STAGE = 'iframe[title="Stage"]';
const TIMES = [0, 0.25, 0.5, 0.75, 1];

async function openLab(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await page.goto("/editor/stage-lab", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((sel) => !!document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.getElementById("stage-root"), STAGE, { timeout: 45_000 });
  // Clicking before the page has hydrated does nothing, so click again until the scenes are in the frame.
  await expect
    .poll(
      async () => {
        await page.getByRole("button", { name: "Load 5 compositing scenes" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_"]').length ?? 0, STAGE);
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThanOrEqual(5);
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
}

const seek = async (page: Page, time: number) => {
  await page.evaluate((t) => window.__LL_ENGINE__!.seek(t), time);
  await page.waitForTimeout(150); // the engine writes in the next frame's apply phase
};
const kernel = (page: Page, id: string, time: number) => page.evaluate(({ id, time }) => window.__LL_ENGINE__!.kernel(id, time), { id, time });
const computed = (page: Page, id: string, property: string) =>
  page.evaluate(({ sel, id, property }) => {
    const doc = document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!;
    return doc.defaultView!.getComputedStyle(doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!).getPropertyValue(property);
  }, { sel: STAGE, id, property });
/** The scene's own box as pixels: [r, g, b, a] at (x, y) inside the subject layer. */
async function pixel(page: Page, id: string, x: number, y: number): Promise<[number, number, number, number]> {
  const buffer = await page.frameLocator(STAGE).locator(`[data-element-id="${id}"]`).screenshot();
  const png = PNG.sync.read(buffer);
  const scale = png.width / SCENE_BOX.width;
  const i = (Math.round(y * scale) * png.width + Math.round(x * scale)) * 4;
  return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
}
const near = (a: number, b: number, tolerance = 40) => Math.abs(a - b) <= tolerance;
/** The SVG inside a computed `mask-image: url("data:image/svg+xml;utf8,…")`. */
const maskSvg = (css: string) => decodeURIComponent(/data:image\/svg\+xml;utf8,(.*)"\)\s*$/.exec(css)![1]);

test("Phase 74: five compositing scenes at five times match evaluate() in the real stage", async ({ page }) => {
  await openLab(page);

  // blend: always a multiply, whatever the time (nothing animates it)
  for (const t of TIMES) {
    await seek(page, t);
    expect(await computed(page, sceneId("blend"), "mix-blend-mode"), `blend at ${t}`).toBe("multiply");
  }
  const [r, g, b] = await pixel(page, sceneId("blend"), 60, 50);
  expect([near(r, 128), near(g, 0), near(b, 0)], `red multiplied by (128,128,255) is (128,0,0): got ${[r, g, b]}`).toEqual([true, true, true]);

  // isolation
  expect(await computed(page, sceneId("isolation"), "isolation")).toBe("isolate");

  // adjustment: the backdrop filter is the kernel's blur at each time, and the red | blue edge softens as it grows
  let softest = 0;
  for (const t of TIMES) {
    await seek(page, t);
    const blur = (await kernel(page, sceneId("adjustment"), t))["adjust.blur"] as number;
    const filter = await computed(page, sceneId("adjustment"), "backdrop-filter");
    expect(filter === "none" ? 0 : parseFloat(/blur\(([\d.]+)px\)/.exec(filter)![1]), `adjustment at ${t}`).toBeCloseTo(blur, 2);
    const [pr] = await pixel(page, sceneId("adjustment"), SCENE_BOX.width / 2 - 6, 50);
    softest = Math.max(softest, 255 - pr);
  }
  expect(softest, "by the end the red side has picked up blue at the edge").toBeGreaterThan(20);

  // alpha mask: an ellipse as wide as the kernel says; the layer shows where the ellipse is
  for (const t of TIMES) {
    await seek(page, t);
    const width = (await kernel(page, sceneId("alphaMask"), t))["mask.width"] as number;
    const svg = maskSvg(await computed(page, sceneId("alphaMask"), "mask-image"));
    const rx = Number(/rx="([\d.]+)"/.exec(svg)![1]);
    expect(rx, `ellipse radius at ${t}`).toBeCloseTo(width / 2, 2);
  }
  const isRed = (p: number[]) => p[0] > 200 && p[1] < 60 && p[2] < 60 && p[3] > 200;
  await seek(page, 1);
  const grown = await pixel(page, sceneId("alphaMask"), 60, 50);
  expect(isRed(grown), `the grown ellipse shows the layer at its centre: ${grown}`).toBe(true);
  const clipped = await pixel(page, sceneId("alphaMask"), 4, 4);
  expect(isRed(clipped), `the corner outside the ellipse is hidden: ${clipped}`).toBe(false);
  await seek(page, 0);
  const tiny = await pixel(page, sceneId("alphaMask"), 100, 50);
  expect(isRed(tiny), `at the start the tiny ellipse leaves the right side hidden: ${tiny}`).toBe(false);

  // luma mask: the path in the image is the kernel's path, from a square to a diamond
  for (const t of TIMES) {
    await seek(page, t);
    const expected = (await kernel(page, sceneId("lumaMorph"), t))["mask.path"] as string;
    const svg = maskSvg(await computed(page, sceneId("lumaMorph"), "mask-image"));
    expect(/<path d="([^"]*)"/.exec(svg)![1], `morph at ${t}`).toBe(expected);
  }
  await seek(page, 0);
  expect(maskSvg(await computed(page, sceneId("lumaMorph"), "mask-image"))).toContain(SCENE_SQUARE);
  const squareCorner = await pixel(page, sceneId("lumaMorph"), 12, 12);
  expect(isRed(squareCorner), `the square shows the layer near its corner: ${squareCorner}`).toBe(true);
  await seek(page, 1);
  expect(maskSvg(await computed(page, sceneId("lumaMorph"), "mask-image"))).toContain(SCENE_DIAMOND);
  const diamondCorner = await pixel(page, sceneId("lumaMorph"), 12, 12);
  expect(isRed(diamondCorner), `the diamond leaves that corner empty: ${diamondCorner}`).toBe(false);
  const diamondCentre = await pixel(page, sceneId("lumaMorph"), 60, 50);
  expect(isRed(diamondCentre), `and shows the layer at its centre: ${diamondCentre}`).toBe(true);
});
