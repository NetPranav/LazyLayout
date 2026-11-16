/**
 * ROADMAP Phase 86 gate: the motion-path orbit reference matches `evaluate()` at five times in the real stage (the dev
 * page /editor/stage-lab), in every browser, and a layer is put on a path from the new editor's inspector:
 *   - the dot's written transform is the kernel's, and its drawn centre is on the drawn circle at that share of a lap
 *     (constant speed), measured against the path layer's own box;
 *   - the arrow, a quarter of a lap ahead and turning along the path, is rotated by the path's direction;
 *   - in /editor, "Path to follow" and "Travel along the path" set the properties and the keyframes, and the layer is
 *     drawn on the path at the playhead.
 */
import { test, expect, type Page } from "@playwright/test";
import { ORBIT_ARROW, ORBIT_CIRCLE, ORBIT_DOT, ORBIT_TRACK } from "../../src/legacy-editor/stage-lab/compositingScenes";
import { pathSampler } from "../../src/core/paths/pathFollow";
import { chooseOption, openEditor } from "./support/editor";

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
        await page.getByRole("button", { name: "Load orbit scene" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_orbit"]').length ?? 0, STAGE);
      },
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    )
    .toBeGreaterThanOrEqual(3);
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
}
const kernel = (page: Page, id: string, time: number) => page.evaluate(({ id, time }) => window.__LL_ENGINE__!.kernel(id, time), { id, time });
/** A layer's written transform, and where its box and the track's box are drawn, inside the stage frame. */
const drawn = (page: Page, id: string) =>
  page.evaluate(({ sel, id, track }) => {
    const doc = document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!;
    const el = doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`)!;
    const r = el.getBoundingClientRect();
    const t = doc.querySelector<HTMLElement>(`[data-element-id="${track}"]`)!.getBoundingClientRect();
    return { transform: el.style.transform, cx: r.left + r.width / 2, cy: r.top + r.height / 2, track: { x: t.left, y: t.top, width: t.width, height: t.height } };
  }, { sel: STAGE, id, track: ORBIT_TRACK });

test("Phase 86: the orbit at five times matches evaluate() in the real stage, at constant speed", async ({ page }) => {
  await openLab(page);
  const sampler = pathSampler(ORBIT_CIRCLE)!;
  for (const t of TIMES) {
    await page.evaluate((time) => window.__LL_ENGINE__!.seek(time), t);
    const k = await kernel(page, ORBIT_DOT, t);
    // the engine draws on the frame after the seek
    await expect.poll(async () => (await drawn(page, ORBIT_DOT)).transform, { message: `the dot's transform at ${t}` }).toBe(k.transform as string);
    const dot = await drawn(page, ORBIT_DOT);
    const at = sampler.at(t);
    // the path layer is 200 x 200, the size of its own drawing space, so a point on the path is that many px into its box
    expect(dot.cx - dot.track.x, `the dot is on the circle at ${t} (x)`).toBeCloseTo(at.x, 0);
    expect(dot.cy - dot.track.y, `the dot is on the circle at ${t} (y)`).toBeCloseTo(at.y, 0);
    expect(Math.hypot(dot.cx - dot.track.x - 100, dot.cy - dot.track.y - 100), `80 px from the middle at ${t}`).toBeCloseTo(80, 0);

    // the arrow is a quarter of a lap ahead and turned to face the way it travels
    const ka = await kernel(page, ORBIT_ARROW, t);
    await expect.poll(async () => (await drawn(page, ORBIT_ARROW)).transform, { message: `the arrow's transform at ${t}` }).toBe(ka.transform as string);
    expect(ka["transform.rotate"] as number, `the arrow's turn at ${t}`).toBeCloseTo(sampler.at(t + 0.25).angle, 2);
    const arrow = await drawn(page, ORBIT_ARROW);
    expect(arrow.cx - arrow.track.x, `the arrow is a quarter lap ahead at ${t}`).toBeCloseTo(sampler.at(t + 0.25).x, 0);
  }
  // constant speed: a quarter of the time is a quarter of the way round (the bottom of the circle, going clockwise)
  await page.evaluate(() => window.__LL_ENGINE__!.seek(0.25));
  await expect.poll(async () => { const d = await drawn(page, ORBIT_DOT); return Math.round(d.cy - d.track.y); }).toBe(180);
});

// ---------------------------------------------------------------------------
// The new editor: the Follow a path section
// ---------------------------------------------------------------------------

type L = { id: string; name: string; properties: Record<string, unknown> };
type Doc = { layers: Record<string, L>; clips: Record<string, { layerId: string; tracks: Array<{ property: string; keyframes: Array<{ time: number; value: unknown }> }> }> };
type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => Doc; commands: { addLayer: (l: unknown) => string } }; __LL_ENGINE__?: { seek: (t: number) => void } };
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get())) as Doc);
const props = async (page: Page, id: string) => (await doc(page)).layers[id].properties;
const track = async (page: Page, id: string) => Object.values((await doc(page)).clips).filter((c) => c.layerId === id).flatMap((c) => c.tracks).find((t) => t.property === "motionPath.progress");

test.describe("Phase 86 in the new editor", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("the Follow a path section puts a layer on a path, sends it along, and takes it off", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    const ids = await page.evaluate((circle) => {
      const c = (window as unknown as Win).__LL_DOC__.commands;
      return {
        path: c.addLayer({ archetype: "svgPath", parentId: "hero", name: "Orbit path", properties: { positioning: "absolute", "frame.x": 200, "frame.y": 60, "frame.width": 200, "frame.height": 200, "svg.path": circle, "svg.stroke": "#0f172a", "svg.strokeWidth": 2, "svg.fill": "none" } }),
        dot: c.addLayer({ archetype: "rectangle", parentId: "hero", name: "Traveller", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 30, "frame.height": 30 } }),
      };
    }, ORBIT_CIRCLE);

    await page.getByRole("tab", { name: "Motion" }).click();
    await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
    await page.locator(`[data-testid="stage-element"][data-element-id="${ids.dot}"]`).click();
    const section = page.locator('[data-section="follow-path"]');
    await section.scrollIntoViewIfNeeded();

    // nothing but the path menu until a path is chosen
    await expect(page.getByLabel("Path position", { exact: true })).toHaveCount(0);
    await chooseOption(page, "Path to follow", "Orbit path");
    await expect.poll(async () => (await props(page, ids.dot))["motionPath.source"]).toBe(ids.path);

    // the journey: two keyframes, start to end, over the length
    const length = page.getByLabel("Travel length", { exact: true }).first();
    await length.fill("2");
    await length.press("Enter");
    await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(0));
    await page.getByRole("button", { name: "Travel along the path", exact: true }).click();
    await expect.poll(async () => (await track(page, ids.dot))?.keyframes.map((k) => [k.time, k.value])).toEqual([[0, 0], [2, 1]]);
    await expect(section.locator('[data-path-animation="motionPath.progress"]')).toContainText("Travels · 0.00s to 2.00s");

    // the stage draws the layer on the path: its centre, as a share of the path's box, is the path's point at each time
    const sampler = pathSampler(ORBIT_CIRCLE)!;
    const share = async () =>
      page.evaluate(({ dot, path }) => {
        const d = document.querySelector(`[data-testid="stage-page"] [data-element-id="${dot}"]`)!.getBoundingClientRect();
        const p = document.querySelector(`[data-testid="stage-page"] [data-element-id="${path}"]`)!.getBoundingClientRect();
        return { x: (d.left + d.width / 2 - p.left) / p.width, y: (d.top + d.height / 2 - p.top) / p.height };
      }, { dot: ids.dot, path: ids.path });
    for (const t of [0, 0.5, 1, 1.5]) {
      await page.evaluate((time) => (window as unknown as Win).__LL_ENGINE__!.seek(time), t);
      const at = sampler.at(t / 2);
      await expect.poll(async () => Math.round((await share()).x * 100), { message: `x at ${t} s` }).toBe(Math.round(at.x / 2));
      expect((await share()).y * 100, `y at ${t} s`).toBeCloseTo(at.y / 2, 0);
    }

    // turn along the path, and an offset
    await page.getByRole("button", { name: "Turn along the path", exact: true }).click();
    await expect.poll(async () => (await props(page, ids.dot))["motionPath.autoRotate"]).toBe(true);
    const offset = page.getByLabel("Path offset", { exact: true }).first();
    await offset.fill("25");
    await offset.press("Enter");
    await expect.poll(async () => (await props(page, ids.dot))["motionPath.offset"]).toBe(0.25);

    // the journey is removed from its line; the layer is taken off the path from the menu
    await page.getByRole("button", { name: "Remove animation: Travels along the path", exact: true }).click();
    await expect.poll(async () => track(page, ids.dot)).toBeUndefined();
    await chooseOption(page, "Path to follow", "None");
    await expect.poll(async () => (await props(page, ids.dot))["motionPath.source"]).toBeUndefined();
    await expect(page.getByLabel("Path position", { exact: true })).toHaveCount(0);
  });
});
