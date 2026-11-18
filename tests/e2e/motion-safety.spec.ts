/**
 * ROADMAP Phase 93 (second half): the Motion safety section. A layer that strobes and never stops is listed with two
 * problems; "Slow it down" clears the flashing, "Let visitors pause it" clears the loop, undo brings one back, and
 * the whole-page line counts what is left.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type Win = {
  __LL_TEST__: boolean;
  __LL_SELECT__: (id: string) => void;
  __LL_DOC__: { get: () => { layers: Record<string, { properties: Record<string, unknown> }>; clips: Record<string, { duration: number; layerId: string }> }; commands: { addLayer: (l: unknown) => string; addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string } };
};
test.use({ viewport: { width: 1600, height: 1000 } });
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get())) as ReturnType<Win["__LL_DOC__"]["get"]>);

test("Phase 93: motion safety lists a strobing endless loop and fixes it", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_DOC__);
  const id = await page.evaluate(() => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    const layerId = c.addLayer({ archetype: "container", parentId: "hero", name: "Strobe", properties: { positioning: "absolute", "frame.x": 20, "frame.y": 40, "frame.width": 80, "frame.height": 60 } });
    const keys = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0].map((v, i) => ({ id: `k${i}`, time: i / 12, value: v }));
    c.addClip(layerId, { id: "clip_strobe", name: "Strobe", type: "loop", trigger: "mount", duration: 1, easing: "linear", repeat: -1, enabled: true, tracks: [{ id: "trk_strobe", property: "appearance.opacity", keyframes: keys }] }, "Test animation", { compositionId: "comp_main" });
    return layerId;
  });
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  const section = page.locator('[data-section="motion-safety"]');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("status", { name: "Motion safety", exact: true })).toContainText("2 problems");
  await expect(section.locator('[data-rule="flash"]')).toContainText("times a second");

  await section.getByRole("button", { name: "Slow it down: Flashing" }).click();
  await expect(section.getByRole("status", { name: "Motion safety", exact: true })).toContainText("1 problem");
  expect((await doc(page)).clips["clip_strobe"].duration).toBeGreaterThan(1);

  await section.getByRole("button", { name: "Let visitors pause it: Can't pause" }).click();
  await expect(section.getByRole("status", { name: "Motion safety", exact: true })).toContainText("No problems");
  expect((await doc(page)).layers[id].properties["motion.pausable"]).toBe(true);
  await expect(section.getByLabel("Visitors can pause this motion")).toBeVisible();

  await page.keyboard.press("Control+z");
  await expect(section.getByRole("status", { name: "Motion safety", exact: true })).toContainText("1 problem");
  await expect(section.getByRole("status", { name: "Whole page motion safety" })).toContainText("1 can't pause");
});
