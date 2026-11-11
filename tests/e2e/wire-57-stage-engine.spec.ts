/**
 * Phase 57 on the new canvas (/editor): the engine's stage adapters animate the drawn layers. Ten reference animations
 * (the same as the old stage lab), each seeked to five times, match the evaluation kernel within 0.5 px (opacity within
 * 0.005). In Design the canvas shows the design at rest; in Motion the engine shows the playhead's frame.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

const TIMES = [0, 0.2, 0.5, 0.8, 1];
const REFS: Array<[property: string, from: number, to: number, ease: string]> = [
  ["transform.x", 0, 240, "linear"],
  ["transform.y", -50, 50, "power2.inOut"],
  ["transform.x", 300, 0, "power4.in"],
  ["transform.y", 0, 120, "power2.in"],
  ["frame.width", 40, 160, "power1.out"],
  ["frame.height", 120, 30, "linear"],
  ["frame.x", 10, 300, "power3.out"],
  ["frame.y", 10, 150, "linear"],
  ["appearance.radius", 0, 40, "power2.out"],
  ["appearance.opacity", 1, 0.2, "power1.inOut"],
];

type Engine = { kernel: (id: string, t: number) => Record<string, unknown>; seek: (t: number) => void };
type Win = {
  __LL_TEST__: boolean;
  __LL_ENGINE__?: Engine;
  __LL_DOC__: { commands: { addLayer: (l: unknown) => string; addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string } };
};

async function build(page: Page): Promise<string[]> {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  return page.evaluate((refs) => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    let n = 0;
    const id = (p: string) => `${p}_w57_${n++}`;
    return refs.map(([property, from, to, ease], i) => {
      const layerId = c.addLayer({
        archetype: "rectangle",
        parentId: "hero",
        name: `Reference ${i}`,
        properties: { positioning: "absolute", "frame.x": 20 + (i % 5) * 150, "frame.y": 20 + Math.floor(i / 5) * 200, "frame.width": 80, "frame.height": 60, "svg.fill": "#3366ff" },
      });
      c.addClip(
        layerId,
        { id: id("clip"), name: `Reference ${i}`, type: "entrance", trigger: "mount", duration: 1, easing: "linear", enabled: true, tracks: [{ id: id("trk"), property, keyframes: [{ id: id("kf"), time: 0, value: from }, { id: id("kf"), time: 1, value: to, ease }] }] },
        "Reference animation",
        { compositionId: "comp_main" },
      );
      return layerId;
    });
  }, REFS);
}

/** What the canvas shows for one property of one layer, in the property's own unit. */
const shown = (page: Page, id: string, property: string) =>
  page.evaluate(
    ({ id, property }) => {
      const el = document.querySelector<HTMLElement>(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`)!;
      const style = getComputedStyle(el);
      const m = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
      switch (property) {
        case "transform.x": return m.m41;
        case "transform.y": return m.m42;
        case "frame.width": return parseFloat(style.width);
        case "frame.height": return parseFloat(style.height);
        case "frame.x": return parseFloat(style.left);
        case "frame.y": return parseFloat(style.top);
        case "appearance.radius": return parseFloat(style.borderTopLeftRadius) || parseFloat(el.querySelector("rect")?.getAttribute("rx") ?? "0");
        default: return Number(style.opacity);
      }
    },
    { id, property },
  );

test("Phase 57 on the new canvas: ten reference animations, seeked to five times, match the kernel", async ({ page }) => {
  const ids = await build(page);
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
  for (const time of TIMES) {
    await page.evaluate((t) => (window as unknown as Win).__LL_ENGINE__!.seek(t), time);
    for (const [i, [property]] of REFS.entries()) {
      const expected = (await page.evaluate(({ id, time }) => (window as unknown as Win).__LL_ENGINE__!.kernel(id, time), { id: ids[i], time }))[property] as number;
      await expect
        .poll(async () => Math.abs((await shown(page, ids[i], property)) - expected), { message: `${property} (${ids[i]}) at ${time}s should be ${expected}`, timeout: 5_000 })
        .toBeLessThanOrEqual(property === "appearance.opacity" ? 0.005 : 0.5);
    }
  }
});

test("Phase 57 on the new canvas: Design shows the design, Motion shows the playhead's frame, and play animates", async ({ page }) => {
  const ids = await build(page);
  const opacityRef = ids[9]; // appearance.opacity 1 -> 0.2
  await expect.poll(() => shown(page, opacityRef, "appearance.opacity"), "Design: the design at rest").toBeCloseTo(1, 2);
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
  await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(1));
  await expect.poll(() => shown(page, opacityRef, "appearance.opacity"), "Motion at 1s: the animation's end").toBeCloseTo(0.2, 2);
  await page.getByRole("tab", { name: "Design" }).click();
  await expect.poll(() => shown(page, opacityRef, "appearance.opacity"), "back in Design: the design at rest again").toBeCloseTo(1, 2);
});
