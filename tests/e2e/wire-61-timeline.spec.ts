/**
 * Phase 61 on the new editor (/editor): a ten-step journey through the timeline (trim, move, work area, marker, solo,
 * lock, undo) that asserts the document after every step. The new timeline trims and moves a layer's animation (its
 * clip), which is what it shows as a bar.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Clip = { id: string; layerId: string; delay?: number; duration: number };
type Doc = {
  layers: Record<string, { solo?: boolean; locked?: boolean }>;
  clips: Record<string, Clip>;
  compositions: Record<string, { workArea: { start: number; end: number }; markers: Array<{ time: number; label: string }> }>;
};
type Engine = { seek: (t: number) => void; time: () => number; document: () => Doc };
type Win = { __LL_TEST__: boolean; __LL_ENGINE__?: Engine };

const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_ENGINE__!.document())) as Doc);
const comp = async (page: Page) => (await doc(page)).compositions.comp_main;
const clipOf = async (page: Page, layerId: string) => Object.values((await doc(page)).clips).find((c) => c.layerId === layerId)!;
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);

async function drag(page: Page, from: { x: number; y: number }, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(from.x + (dx * i) / 6, from.y);
  await page.mouse.up();
}
const centre = async (locator: ReturnType<Page["locator"]>) => {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("Phase 61 on the new editor: a ten-step timeline journey, the document checked after each step", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);

  // 1. The timeline lists the animated layers, and the document has them.
  const headingRow = page.locator('.tlrow[data-layer-id="headline"]');
  const buttonRow = page.locator('.tlrow[data-layer-id="button"]');
  await expect(headingRow).toBeVisible();
  await expect(buttonRow).toBeVisible();
  const before = await clipOf(page, "headline");
  expect(before.duration).toBeGreaterThan(0);

  // 2-3. Trim the headline's animation: its end in, then its start in.
  const headingClip = page.locator('[data-testid="timeline-clip"][data-layer-id="headline"]');
  await drag(page, await centre(headingClip.locator(".ch.r")), -40);
  await expect.poll(async () => (await clipOf(page, "headline")).duration, "the end trimmed in").toBeLessThan(before.duration);
  const afterEnd = await clipOf(page, "headline");
  await drag(page, await centre(headingClip.locator(".ch").first()), 20);
  await expect.poll(async () => (await clipOf(page, "headline")).delay ?? 0, "the start trimmed in").toBeGreaterThan(afterEnd.delay ?? 0);

  // 4. Move the button's animation later. It fills the whole composition, so trim its end in first to give it room.
  const buttonClip = page.locator('[data-testid="timeline-clip"][data-layer-id="button"]');
  const fullDuration = (await clipOf(page, "button")).duration;
  await drag(page, await centre(buttonClip.locator(".ch.r")), -300);
  await expect.poll(async () => (await clipOf(page, "button")).duration, "the button's end trimmed in").toBeLessThan(fullDuration);
  const buttonBefore = (await clipOf(page, "button")).delay ?? 0;
  const bb = (await buttonClip.boundingBox())!;
  await drag(page, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, 150);
  await expect.poll(async () => (await clipOf(page, "button")).delay ?? 0, "the button's animation moved later").toBeGreaterThan(buttonBefore);

  // 5-6. The work area from the playhead: start at 1 s, end at 3 s, saved in the composition.
  await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(1));
  await page.getByRole("button", { name: "Work area in at playhead (I)" }).click();
  await expect.poll(async () => (await comp(page)).workArea.start).toBeCloseTo(1, 1);
  await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(3));
  await page.getByRole("button", { name: "Work area out at playhead (O)" }).click();
  await expect.poll(async () => (await comp(page)).workArea.end).toBeCloseTo(3, 1);
  expect((await comp(page)).workArea.start).toBeCloseTo(1, 1);

  // 7. A marker at the playhead (3 s).
  const markersBefore = (await comp(page)).markers.length;
  await page.getByRole("button", { name: "Add marker (M)" }).click();
  await expect.poll(async () => (await comp(page)).markers.length).toBe(markersBefore + 1);
  expect((await comp(page)).markers.at(-1)!.time).toBeCloseTo(3, 1);

  // 8. Solo the headline: saved, and the canvas draws only it (the button disappears).
  await expect(drawn(page, "button")).toHaveCount(1);
  await headingRow.locator('[data-la="solo"]').click();
  await expect.poll(async () => (await doc(page)).layers.headline.solo).toBe(true);
  await expect(drawn(page, "button")).toHaveCount(0);
  await expect(drawn(page, "headline")).toHaveCount(1);

  // 9. Lock the headline.
  await headingRow.locator('[data-la="lock"]').click();
  await expect.poll(async () => (await doc(page)).layers.headline.locked).toBe(true);

  // 10. Undo: the lock goes, then the solo goes and the button is drawn again; the earlier steps stay.
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await doc(page)).layers.headline.locked ?? false).toBe(false);
  expect((await doc(page)).layers.headline.solo).toBe(true);
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await doc(page)).layers.headline.solo ?? false).toBe(false);
  await expect(drawn(page, "button")).toHaveCount(1);
  expect((await comp(page)).markers.length).toBe(markersBefore + 1);
  expect((await comp(page)).workArea.end).toBeCloseTo(3, 1);
});
