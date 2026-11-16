/**
 * ROADMAP Phase 88 gate: a per-breakpoint motion override plays only at its width on the stage.
 * A rectangle slides 100 px over two seconds. Viewed at Mobile, "Motion at this size" makes it travel a quarter as
 * far, then not play at all; viewed at the base again it slides the whole way; "Same as larger sizes" takes Mobile's
 * settings off.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; properties: Record<string, unknown>; overrides?: Record<string, Record<string, unknown>> };
type Win = {
  __LL_TEST__: boolean;
  __LL_SELECT__: (id: string) => void;
  __LL_ENGINE__?: { seek: (t: number) => void; document: () => { layers: Record<string, L> } };
  __LL_DOC__: { commands: { addLayer: (l: unknown) => string; addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string } };
  __LL_COMMANDS__?: { all: () => Array<{ id: string; run: (a?: unknown) => unknown }> };
};
test.use({ viewport: { width: 1600, height: 1000 } });
const run = (page: Page, id: string, args?: unknown) => page.evaluate(({ id, args }) => (window as unknown as Win).__LL_COMMANDS__!.all().find((c) => c.id === id)!.run(args), { id, args });
const layer = (page: Page, id: string) => page.evaluate((x) => JSON.parse(JSON.stringify((window as unknown as Win).__LL_ENGINE__!.document().layers[x])) as L, id);
/** The x the layer is drawn at by its transform, at a time. */
const drawnAt = async (page: Page, id: string, time: number) => {
  await page.evaluate((t) => (window as unknown as Win).__LL_ENGINE__!.seek(t), time);
  await page.waitForTimeout(120);
  return page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().evaluate((e) => Math.round(new DOMMatrixReadOnly(getComputedStyle(e as HTMLElement).transform).m41 * 100) / 100);
};
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};

test("Phase 88: a calmer animation on Mobile plays only there", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__ && !!(window as unknown as Win).__LL_COMMANDS__);
  const id = await page.evaluate(() => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    const layerId = c.addLayer({ archetype: "rectangle", parentId: "hero", name: "Slider", properties: { positioning: "absolute", "frame.x": 20, "frame.y": 40, "frame.width": 80, "frame.height": 60 } });
    c.addClip(layerId, { id: "clip_slider", name: "Slide", type: "entrance", trigger: "mount", duration: 2, easing: "linear", enabled: true, tracks: [{ id: "trk_slider", property: "transform.x", keyframes: [{ id: "k0", time: 0, value: 0 }, { id: "k1", time: 2, value: 100 }] }] }, "Test animation", { compositionId: "comp_main" });
    return layerId;
  });
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  const section = page.locator('[data-section="motion-at"]');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("status")).toContainText("At every size");
  expect(await drawnAt(page, id, 1)).toBe(50);

  // viewed at Mobile: a quarter of the distance
  await run(page, "breakpoint.set", { id: "mobile" });
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  await expect(section.getByRole("status")).toContainText("At Mobile");
  expect(await drawnAt(page, id, 1), "nothing set for Mobile yet: as everywhere").toBe(50);
  await set(page, "Animation distance at this size", 25);
  await expect.poll(async () => (await layer(page, id)).overrides?.mobile?.["motion.distance"]).toBe(0.25);
  expect((await layer(page, id)).properties["motion.distance"], "the base is untouched").toBeUndefined();
  expect(await drawnAt(page, id, 1)).toBe(12.5);
  expect(await drawnAt(page, id, 2)).toBe(25);

  // and twice as slow
  await set(page, "Animation time at this size", 200);
  await expect.poll(async () => (await layer(page, id)).overrides?.mobile?.["motion.timeScale"]).toBe(2);
  expect(await drawnAt(page, id, 2), "half way through a clip that now takes four seconds").toBe(12.5);

  // back at the base: the whole way, at the written speed
  await run(page, "breakpoint.set", { id: null });
  expect(await drawnAt(page, id, 1)).toBe(50);
  expect(await drawnAt(page, id, 2)).toBe(100);

  // Mobile again: off, then "same as larger sizes"
  await run(page, "breakpoint.set", { id: "mobile" });
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), id);
  await page.getByLabel("Animation plays at this size", { exact: true }).click();
  await expect.poll(async () => (await layer(page, id)).overrides?.mobile?.["motion.plays"]).toBe(false);
  expect(await drawnAt(page, id, 1)).toBe(0);
  await page.getByRole("button", { name: "Same motion as larger sizes", exact: true }).click();
  await expect.poll(async () => (await layer(page, id)).overrides?.mobile?.["motion.plays"]).toBeUndefined();
  await expect(page.getByRole("button", { name: "Same motion as larger sizes", exact: true })).toHaveCount(0);
  expect(await drawnAt(page, id, 1)).toBe(50);
});
