/**
 * Phase 62 on the new editor (/editor): a layer's Properties twirl opens into its groups, every property has a
 * stopwatch, and a stopwatch on and off round-trips through undo and save. U reveals the animated properties.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Track = { property: string; keyframes: Array<{ time: number }> };
type Doc = { clips: Record<string, { layerId: string; tracks: Track[] }> };
type Win = { __LL_TEST__: boolean; __LL_ENGINE__?: { seek: (t: number) => void; document: () => Doc } };

const tracksOf = (page: Page, layerId: string, property: string) =>
  page.evaluate(
    ({ layerId, property }) =>
      Object.values((window as unknown as Win).__LL_ENGINE__!.document().clips)
        .filter((c) => c.layerId === layerId)
        .flatMap((c) => c.tracks.filter((t) => t.property === property).map((t) => ({ property: t.property, keyframes: t.keyframes.map((k) => ({ time: k.time })) }))),
    { layerId, property },
  );

async function openMotion(page: Page) {
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
}

test("Phase 62 on the new editor: twirl, groups, and a stopwatch on and off round-trips through undo and save", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await openMotion(page);

  // The headline's Properties twirl lists the six groups; Transform lists its properties, each with a stopwatch.
  await page.getByRole("button", { name: /^Show properties of Headline/ }).click();
  for (const group of ["Transform", "Appearance", "Effects", "States", "Behaviours", "Links"]) {
    await expect(page.locator('[data-timeline-group^="headline|"]').filter({ hasText: group })).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Open Transform of Headline" }).click();
  const skew = page.locator('[data-timeline-property="headline|transform.skewX"]');
  const stopwatch = skew.getByRole("button", { name: "Animate Skew X of Headline" });
  await expect(stopwatch).toHaveAttribute("aria-pressed", "false");
  expect(await tracksOf(page, "headline", "transform.skewX")).toEqual([]);

  // On: one keyframe at the playhead (1 s).
  await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(1));
  await stopwatch.click();
  await expect(stopwatch).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await tracksOf(page, "headline", "transform.skewX")).length).toBe(1);
  const [track] = await tracksOf(page, "headline", "transform.skewX");
  expect(track.keyframes).toHaveLength(1);
  await expect(skew).toHaveAttribute("data-key-count", "1");

  // Undo turns it off in one step; redo turns it on again.
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Control+z");
  await expect(stopwatch).toHaveAttribute("aria-pressed", "false");
  expect(await tracksOf(page, "headline", "transform.skewX")).toEqual([]);
  await page.keyboard.press("Control+Shift+z");
  await expect(stopwatch).toHaveAttribute("aria-pressed", "true");

  // Saved: after a reload the stopwatch is still on, with its keyframe.
  await waitSaved(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"));
  await openMotion(page);
  await page.getByRole("button", { name: /^Show properties of Headline/ }).click();
  await page.getByRole("button", { name: "Open Transform of Headline" }).click();
  const again = page.locator('[data-timeline-property="headline|transform.skewX"]');
  await expect(again.getByRole("button", { name: "Animate Skew X of Headline" })).toHaveAttribute("aria-pressed", "true");
  await expect(again).toHaveAttribute("data-key-count", "1");

  // Off removes its keyframes; undo brings them back.
  await again.getByRole("button", { name: "Animate Skew X of Headline" }).click();
  await expect.poll(async () => (await tracksOf(page, "headline", "transform.skewX")).length).toBe(0);
  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Control+z");
  await expect.poll(async () => (await tracksOf(page, "headline", "transform.skewX")).length).toBe(1);
});

test("Phase 62 on the new editor: U reveals only the animated properties", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await page.locator('[data-testid="stage-element"][data-element-id="headline"]').click();
  await openMotion(page);
  // the timeline has focus once the pointer is over it
  await page.locator('[data-testid="timeline-ruler"]').hover();
  await page.keyboard.press("u");
  const rows = page.locator('[data-timeline-property^="headline|"]');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let i = 0; i < count; i++) await expect(rows.nth(i).getByRole("button", { name: /^Animate / })).toHaveAttribute("aria-pressed", "true");
});
