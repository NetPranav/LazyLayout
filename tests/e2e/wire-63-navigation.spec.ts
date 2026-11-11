/**
 * Phase 63 on the new editor (/editor): a keyboard-only navigation journey lands on exact times. With the pointer over
 * the timeline: Page Down / Page Up step frames (Shift: ten), I and O go to the selected layer's in and out points (the
 * work area's ends with nothing selected), B and N set the work area from the playhead, = and - zoom, \ fits the work
 * area, End goes to the end, and Space toggles playback exactly once.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

const FPS = 60;
type Doc = { compositions: Record<string, { workArea: { start: number; end: number } }> };
type Win = {
  __LL_TEST__: boolean;
  __LL_ENGINE__?: { time: () => number; document: () => Doc };
  __LL_TRANSPORT__?: () => { playing: boolean };
  __LL_COMMANDS__?: { all: () => Array<{ id: string; run: (a?: unknown) => unknown }>; context: () => Record<string, unknown> };
};

const time = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.time());
const workArea = async (page: Page) => (await page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_ENGINE__!.document())) as Doc)).compositions.comp_main.workArea;
const expectTime = (page: Page, seconds: number) => expect.poll(() => time(page), { message: `the playhead should be at exactly ${seconds} s` }).toBeCloseTo(seconds, 6);
const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as Win).__LL_COMMANDS__!.all().find((c) => c.id === id)!.run(args), { id, args });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__ && !!(window as unknown as Win).__LL_COMMANDS__);
  // The headline's bar runs from 1 s to 3 s (set through the command, so the journey below is keyboard only).
  await run(page, "timeline.setLayerBar", { layerId: "headline", in: 1, out: 3 });
  // into the timeline: a click on its ruler (so keyboard focus leaves the mode tabs, where Home and End move between
  // tabs), with the pointer staying over it (its focus scope)
  await page.locator('[data-testid="timeline-ruler"]').click();
}

test("Phase 63 on the new editor: a keyboard-only journey lands on exact times", async ({ page }) => {
  await setup(page);
  const key = (k: string) => page.keyboard.press(k);

  // Frames: Page Down / Page Up, Shift for ten; never before the start.
  await key("Home");
  await expectTime(page, 0);
  for (let i = 0; i < 3; i++) await key("PageDown");
  await expectTime(page, 3 / FPS);
  await key("Shift+PageDown");
  await expectTime(page, 13 / FPS);
  await key("PageUp");
  await expectTime(page, 12 / FPS);
  await key("Shift+PageUp");
  await expectTime(page, 2 / FPS);
  await key("Shift+PageUp");
  await expectTime(page, 0);

  // An arrow steps exactly one frame (not two).
  await key("ArrowRight");
  await expectTime(page, 1 / FPS);

  // I and O: the selected headline's in and out points.
  await key("i");
  await expectTime(page, 1);
  await key("o");
  await expectTime(page, 3);

  // B and N: the work area from the playhead, saved.
  await key("i");
  await key("b");
  await expect.poll(async () => (await workArea(page)).start).toBeCloseTo(1, 6);
  await key("o");
  await key("n");
  await expect.poll(async () => (await workArea(page)).end).toBeCloseTo(3, 6);

  // Nothing selected: I and O go to the work area's ends.
  await run(page, "selection.none");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_COMMANDS__!.context()["selection.count"])).toBe(0);
  await key("Home");
  await key("i");
  await expectTime(page, 1);
  await key("o");
  await expectTime(page, 3);

  // Zoom: = and - step the timeline's pixels per second by 1.25; \ fits the work area (2 s) into the view.
  const pps = async () => Number(await page.locator("[data-pps]").first().getAttribute("data-pps"));
  const before = await pps();
  await key("=");
  await expect.poll(pps).toBeCloseTo(before * 1.25, -1);
  await key("-");
  await expect.poll(pps).toBeCloseTo(before, -1);
  await key("\\");
  await expect.poll(pps, { message: "zoom to the 2 s work area is much wider than the 5 s composition's fit" }).toBeGreaterThan(before * 2);

  // End: the end of the composition.
  await key("End");
  await expectTime(page, 5);

  // Space toggles playback once.
  await key("Home");
  await key("Space");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_TRANSPORT__!().playing)).toBe(true);
  await key("Space");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_TRANSPORT__!().playing)).toBe(false);
});
