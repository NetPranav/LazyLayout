/**
 * ROADMAP Phase 75 gate: a 4-effect stack (blur, drop shadow, colour adjust, displacement), each parameter keyframed, matches
 * what `evaluate()` says at five times in the real stage (the dev page /editor/stage-lab), and motion blur from the
 * layer's own velocity softens a moving layer, in every browser:
 *   - the layer's CSS `filter` carries the kernel's blur radius, shadow offset and saturation, in the list's order, with a
 *     `url()` where the SVG effect sits;
 *   - the SVG filter the engine keeps in the frame has the kernel's displacement scale, updated in place as it animates;
 *   - the pixels follow: grey when saturation reaches 0;
 *   - motion blur's standard deviation equals the kernel's, the moving layer's edge is smeared, and an identical layer
 *     without the switch is not.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { FX_STACK_LAYER, MB_OFF_LAYER, MB_ON_LAYER } from "../../src/legacy-editor/stage-lab/compositingScenes";

const STAGE = 'iframe[title="Stage"]';
const TIMES = [0, 0.25, 0.5, 0.75, 1];
const round = (n: number) => Math.round(n * 1000) / 1000;
/** A computed `filter` as [function, numbers] pairs: browsers write drop-shadow's colour first or last and quote `url("#id")`, so only the order and numbers are compared. */
function parseFilter(filter: string): Array<[string, number[] | string]> {
  const out: Array<[string, number[] | string]> = [];
  for (const m of filter.matchAll(/([a-z-]+)\(((?:[^()]|\([^()]*\))*)\)/g)) {
    if (m[1] === "url") out.push(["url", m[2].replace(/["']/g, "")]);
    else out.push([m[1], (m[2].replace(/rgba?\([^)]*\)/g, "").match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)]);
  }
  return out;
}

async function openLab(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await page.goto("/editor/stage-lab", { waitUntil: "domcontentloaded" });
  await page.waitForFunction((sel) => !!document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.getElementById("stage-root"), STAGE, { timeout: 45_000 });
  await expect
    .poll(
      async () => {
        await page.getByRole("button", { name: "Load effect scenes" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_"]').length ?? 0, STAGE);
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThanOrEqual(3);
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
}
const seek = async (page: Page, time: number) => {
  await page.evaluate((t) => window.__LL_ENGINE__!.seek(t), time);
  await page.waitForTimeout(150);
};
const kernel = (page: Page, id: string, time: number) => page.evaluate(({ id, time }) => window.__LL_ENGINE__!.kernel(id, time), { id, time });

test("Phase 75: a 4-effect stack at five times matches evaluate() in the real stage", async ({ page }) => {
  await openLab(page);
  for (const t of TIMES) {
    await seek(page, t);
    const k = await kernel(page, FX_STACK_LAYER, t);
    const css = await page.evaluate(({ sel, id }) => {
      const doc = document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!;
      const el = doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
      return { filter: el.style.filter, scale: doc.querySelector('[id="fxs-scene_fx-4"] feDisplacementMap')?.getAttribute("scale") ?? null, count: doc.querySelectorAll('svg[data-fx-defs] filter[id^="fxs-scene_fx"]').length };
    }, { sel: STAGE, id: FX_STACK_LAYER });
    const radius = round(k["fx.1.radius"] as number);
    const y = round(k["fx.2.y"] as number);
    const saturate = round(k["fx.3.saturate"] as number);
    const expected: Array<[string, number[] | string]> = [];
    if (radius > 0) expected.push(["blur", [radius]]);
    expected.push(["drop-shadow", [0, y, 6]]);
    if (saturate !== 1) expected.push(["saturate", [saturate]]);
    expected.push(["url", "#fxs-scene_fx-4"]);
    const got = parseFilter(css.filter);
    expect(got.map(([f]) => f), `the effects, in order, at ${t}`).toEqual(expected.map(([f]) => f));
    for (const [i, [name, value]] of expected.entries()) {
      if (typeof value === "string") expect(got[i][1], `${name} at ${t}`).toBe(value);
      else value.forEach((n, j) => expect((got[i][1] as number[])[j], `${name}[${j}] at ${t}`).toBeCloseTo(n, 2));
    }
    expect(Number(css.scale), `displacement scale at ${t}`).toBeCloseTo(k["fx.4.scale"] as number, 2);
    expect(css.count, "one SVG filter, updated in place, never duplicated").toBe(1);
  }
  // the pixels follow: at the end the red layer has no saturation left, so its centre is grey
  await seek(page, 1);
  const buffer = await page.frameLocator(STAGE).locator(`[data-element-id="${FX_STACK_LAYER}"]`).screenshot();
  const png = PNG.sync.read(buffer);
  const i = (Math.round(png.height / 2) * png.width + Math.round(png.width / 2)) * 4;
  const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
  expect(Math.max(Math.abs(r - g), Math.abs(g - b)), `saturate(0) leaves a grey: ${[r, g, b]}`).toBeLessThan(40);
  await seek(page, 0);
  const start = PNG.sync.read(await page.frameLocator(STAGE).locator(`[data-element-id="${FX_STACK_LAYER}"]`).screenshot());
  const j = (Math.round(start.height / 2) * start.width + Math.round(start.width / 2)) * 4;
  expect(start.data[j] > 200 && start.data[j + 1] < 60, `at 0 nothing has changed: still red ${[start.data[j], start.data[j + 1], start.data[j + 2]]}`).toBe(true);
});

test("Phase 75: motion blur follows the layer's velocity, smears its edge, and is off without the switch", async ({ page }) => {
  await openLab(page);
  await seek(page, 0.5);
  const k = await kernel(page, MB_ON_LAYER, 0.5);
  const expectedX = k["motion.blur.x"] as number;
  expect(expectedX, "the kernel blurs a layer moving at 600 px/s").toBeGreaterThan(1);
  const dev = await page.evaluate(({ sel }) => document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelector('[id="mb-scene_mb_on"] feGaussianBlur')?.getAttribute("stdDeviation") ?? null, { sel: STAGE });
  expect(Number(dev!.split(" ")[0]), "the engine's filter carries the kernel's amount").toBeCloseTo(expectedX, 2);
  expect(Number(dev!.split(" ")[1]), "no blur down").toBe(0);
  const filters = await page.evaluate(({ sel }) => ({
    on: (document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelector<HTMLElement>('[data-element-id="scene_mb_on"]')!).style.filter,
    off: (document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelector<HTMLElement>('[data-element-id="scene_mb_off"]')!).style.filter,
  }), { sel: STAGE });
  expect(parseFilter(filters.on)).toEqual([["url", "#mb-scene_mb_on"]]);
  expect(filters.off, "an identical layer without the switch has no filter").toBe("");

  // the pixels: just left of the moving box's left edge is smeared blue with blur, and background without it
  const edge = async (id: string) => {
    const box = (await page.frameLocator(STAGE).locator(`[data-element-id="${id}"]`).boundingBox())!;
    const shot = PNG.sync.read(await page.screenshot({ clip: { x: box.x - 10, y: box.y + box.height / 2 - 2, width: 20, height: 4 } }));
    const scale = shot.width / 20;
    const at = (x: number) => { const p = (Math.round(2 * scale) * shot.width + Math.round(x * scale)) * 4; return [shot.data[p], shot.data[p + 1], shot.data[p + 2]]; };
    return { outside: at(7), inside: at(13) };
  };
  const on = await edge(MB_ON_LAYER);
  const off = await edge(MB_OFF_LAYER);
  expect(on.inside[2] > 120 && on.inside[0] < 100, `inside the box it is blue: ${on.inside}`).toBe(true);
  expect(off.outside[2] > 200 && off.outside[0] > 200, `no switch: outside the edge is the page: ${off.outside}`).toBe(true);
  expect(on.outside[0] < 235, `with motion blur the edge is smeared outward (not the plain page): ${on.outside}`).toBe(true);
});
