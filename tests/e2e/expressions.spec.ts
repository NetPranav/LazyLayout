/**
 * ROADMAP Phase 77 gate: in the real stage, a layer driven by wiggle() shows what the kernel works out at five times, and
 * seeking back and forth gives the same numbers (deterministic). The loopOut layer repeats its slide back and forth.
 * (the dev page /editor/stage-lab), in every browser.
 */
import { test, expect, type Page } from "@playwright/test";
import { EXPR_LOOP, EXPR_WIGGLE } from "../../src/legacy-editor/stage-lab/compositingScenes";

const STAGE = 'iframe[title="Stage"]';
const TIMES = [0, 0.3, 0.6, 1.1, 1.7];

async function openLab(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await page.goto("/editor/stage-lab", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((sel) => !!document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.getElementById("stage-root"), STAGE, { timeout: 45_000 });
  await expect
    .poll(
      async () => {
        await page.getByRole("button", { name: "Load expression scene" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_expr"]').length ?? 0, STAGE);
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
const shown = (page: Page, id: string) =>
  page.evaluate(({ sel, id }) => {
    const doc = document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!;
    const style = doc.defaultView!.getComputedStyle(doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!);
    const m = new DOMMatrix(style.transform === "none" ? undefined : style.transform);
    return { rotation: (Math.atan2(m.b, m.a) * 180) / Math.PI, x: m.m41 };
  }, { sel: STAGE, id });

test("Phase 77: wiggle on the stage matches the kernel at five times and is the same on every seek", async ({ page }) => {
  await openLab(page);
  const first: number[] = [];
  for (const t of TIMES) {
    await seek(page, t);
    const k = await kernel(page, EXPR_WIGGLE, t);
    const x = k["transform.x"] as number;
    expect(Math.abs(x), `within the amplitude at ${t}`).toBeLessThanOrEqual(40 + 1e-6);
    expect(Math.abs(k["transform.rotate"] as number)).toBeLessThanOrEqual(15 + 1e-6);
    const stage = await shown(page, EXPR_WIGGLE);
    expect(stage.x, `the stage's x at ${t}`).toBeCloseTo(x, 1);
    expect(stage.rotation, `the stage's rotation at ${t}`).toBeCloseTo(k["transform.rotate"] as number, 1);
    first.push(x);
  }
  expect(new Set(first.map((v) => v.toFixed(3))).size, "it moves").toBeGreaterThan(2);
  for (const t of [...TIMES].reverse()) {
    await seek(page, t);
    expect((await kernel(page, EXPR_WIGGLE, t))["transform.x"], `the same at ${t} when asked again`).toBe(first[TIMES.indexOf(t)]);
  }
});

test("Phase 77: loopOut repeats the slide back and forth on the stage", async ({ page }) => {
  await openLab(page);
  // the slide runs 0 to 200 px over 0.5 s; pingpong: 0.75 s is 0.25 s back from the end
  for (const [t, want] of [[0.25, 100], [0.75, 100], [1, 0], [1.25, 100]] as const) {
    await seek(page, t);
    const k = (await kernel(page, EXPR_LOOP, t))["transform.x"] as number;
    expect(k, `kernel at ${t}`).toBeCloseTo(want, 1);
    expect((await shown(page, EXPR_LOOP)).x, `stage at ${t}`).toBeCloseTo(k, 1);
  }
});
