/**
 * ROADMAP Phase 76 gate: in the real stage, a layer whose rotation and vertical position are linked to a sliding null follows
 * it, matching `evaluate()` at five times (the dev page /editor/stage-lab), in every browser. The null slides 0 to 400 px; the
 * hero's rotation is that mapped to 0 to 90 degrees (range) and its y that eased and mapped to 0 to 80 px (curve).
 */
import { test, expect, type Page } from "@playwright/test";
import { LINK_HERO, LINK_NULL } from "../../src/legacy-editor/stage-lab/compositingScenes";

const STAGE = 'iframe[title="Stage"]';
const TIMES = [0, 0.25, 0.5, 0.75, 1];

async function openLab(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await page.goto("/editor/stage-lab", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((sel) => !!document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.getElementById("stage-root"), STAGE, { timeout: 45_000 });
  await expect
    .poll(
      async () => {
        await page.getByRole("button", { name: "Load link scene" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_link"]').length ?? 0, STAGE);
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThanOrEqual(2);
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
}
const seek = async (page: Page, time: number) => {
  await page.evaluate((t) => window.__LL_ENGINE__!.seek(t), time);
  await page.waitForTimeout(150);
};
const kernel = (page: Page, id: string, time: number) => page.evaluate(({ id, time }) => window.__LL_ENGINE__!.kernel(id, time), { id, time });
/** What the stage shows for a layer's transform: its rotation (degrees) and its vertical shift (px). */
const shown = (page: Page, id: string) =>
  page.evaluate(({ sel, id }) => {
    const doc = document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!;
    const style = doc.defaultView!.getComputedStyle(doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!);
    const m = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
    return { rotation: (Math.atan2(m.b, m.a) * 180) / Math.PI, y: m.m42, x: m.m41 };
  }, { sel: STAGE, id });

test("Phase 76: linked properties follow their source in the real stage at five times", async ({ page }) => {
  await openLab(page);
  for (const t of TIMES) {
    await seek(page, t);
    const nullX = (await kernel(page, LINK_NULL, t))["transform.x"] as number;
    expect(nullX, `the null slides at ${t}`).toBeCloseTo(400 * t, 3);
    const hero = await kernel(page, LINK_HERO, t);
    expect(hero["transform.rotate"] as number, `the kernel's rotation at ${t}`).toBeCloseTo(90 * t, 3);
    const eased = 80 * Math.pow(t, 3); // power2.in: the position in the range, cubed (GSAP's power2 is t^3 in this engine)
    expect(hero["transform.y"] as number, `the kernel's y at ${t}`).toBeCloseTo(eased, 2);
    const stage = await shown(page, LINK_HERO);
    expect(stage.rotation, `the stage's rotation at ${t}`).toBeCloseTo(hero["transform.rotate"] as number, 1);
    expect(stage.y, `the stage's y at ${t}`).toBeCloseTo(hero["transform.y"] as number, 1);
    expect((await shown(page, LINK_NULL)).x, `the null itself at ${t}`).toBeCloseTo(nullX, 1);
  }
});
