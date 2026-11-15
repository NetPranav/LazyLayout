/**
 * ROADMAP Phase 85 gate: the icon-morph and logo-draw references match `evaluate()` at five times in the real stage (the
 * dev page /editor/stage-lab), in every browser, and the same things are set from the new editor's inspector:
 *   - the menu icon's drawn path is the kernel's at each time, and stays three strokes on the way to the cross;
 *   - each stroke of the logo carries the dash the kernel's `draw.end` and the stagger give it, the drawn length the
 *     browser measures follows, and the pixels follow (nothing at the start, the whole logo at the end);
 *   - in /editor, "Draw the stroke on" and "Morph into…" add the keyframes, the settings are edited in the Morph & draw
 *     section, and the stage shows them at the playhead.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { DRAW_LOGO, ICON_CLOSE, ICON_MENU, LOGO_PATH, MORPH_ICON } from "../../src/legacy-editor/stage-lab/compositingScenes";
import { morphPath, subpathCount, subpathData } from "../../src/core/paths/morphMatch";
import { drawDashes, drawSettings } from "../../src/core/paths/strokeDraw";
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
        await page.getByRole("button", { name: "Load path scenes" }).click();
        return page.evaluate((sel) => document.querySelector<HTMLIFrameElement>(sel)?.contentDocument?.querySelectorAll('[data-element-id^="scene_"]').length ?? 0, STAGE);
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

/** How many pixels of a screenshot are dark (the stroke is near black on a light page). */
function dark(buffer: Buffer): number {
  const png = PNG.sync.read(buffer);
  let n = 0;
  for (let i = 0; i < png.data.length; i += 4) if (png.data[i + 3] > 128 && png.data[i] < 90 && png.data[i + 1] < 90 && png.data[i + 2] < 110) n++;
  return n;
}

test("Phase 85: the icon morph at five times matches evaluate() in the real stage", async ({ page }) => {
  await openLab(page);
  for (const t of TIMES) {
    await seek(page, t);
    const k = (await kernel(page, MORPH_ICON, t))["svg.path"] as string;
    expect(k, `the kernel's path at ${t}`).toBe(t === 0 ? ICON_MENU : t === 1 ? ICON_CLOSE : morphPath(ICON_MENU, ICON_CLOSE, t));
    const drawn = await page.evaluate(({ sel, id }) => document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelector(`[data-element-id="${id}"] path`)!.getAttribute("d"), { sel: STAGE, id: MORPH_ICON });
    expect(drawn, `the drawn path at ${t}`).toBe(k);
    expect(subpathCount(drawn!), `three strokes at ${t}`).toBe(3);
  }
  // the browser draws it: half way the top bar has turned towards the diagonal, so the icon's ink is taller on the left than a bar
  await seek(page, 0.5);
  const box = await page.evaluate(({ sel, id }) => {
    const b = (document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelector(`[data-element-id="${id}"] path`) as SVGPathElement).getBBox();
    return { x: b.x, y: b.y, width: b.width, height: b.height };
  }, { sel: STAGE, id: MORPH_ICON });
  expect(box.x, "half way the strokes start between the menu's 4 and the cross's 6").toBeCloseTo(5, 1);
  expect(box.width).toBeCloseTo(14, 1);
});

test("Phase 85: the logo draw at five times matches evaluate() in the real stage", async ({ page }) => {
  await openLab(page);
  const count = subpathData(LOGO_PATH).length;
  const logo = page.frameLocator(STAGE).locator(`[data-element-id="${DRAW_LOGO}"]`).first();
  const ink: number[] = [];
  for (const t of TIMES) {
    await seek(page, t);
    const k = await kernel(page, DRAW_LOGO, t);
    expect(k["draw.end"], `the kernel's drawn length at ${t}`).toBeCloseTo(t, 6);
    const expected = drawDashes(drawSettings((p) => k[p]), count);
    const drawn = await page.evaluate(({ sel, id }) => {
      const parts = Array.from(document.querySelector<HTMLIFrameElement>(sel)!.contentDocument!.querySelectorAll(`[data-element-id="${id}"] path[data-path-part]`));
      return parts.map((p) => ({ array: p.getAttribute("stroke-dasharray"), offset: p.getAttribute("stroke-dashoffset"), length: p.getAttribute("pathLength"), computed: getComputedStyle(p).strokeDasharray }));
    }, { sel: STAGE, id: DRAW_LOGO });
    expect(drawn.length, "one stroke element per sub-path").toBe(count);
    drawn.forEach((part, i) => {
      if (!expected) {
        expect(part.length, `sub-path ${i} is whole at ${t}`).toBeNull();
        return;
      }
      expect(part.array, `dashes of sub-path ${i} at ${t}`).toBe(expected[i].array);
      expect(Number(part.offset), `dash offset of sub-path ${i} at ${t}`).toBeCloseTo(expected[i].offset, 5);
      expect(part.length).toBe("1");
      expect(part.computed, "the browser took the dashes").not.toBe("none");
    });
    ink.push(dark(await logo.screenshot()));
  }
  // the pixels follow: nothing drawn at the start, more at each time, the whole logo at the end
  expect(ink[0], `nothing is drawn at 0: ${ink}`).toBeLessThan(20);
  for (let i = 1; i < ink.length; i++) expect(ink[i], `more is drawn at ${TIMES[i]} than at ${TIMES[i - 1]}: ${ink}`).toBeGreaterThan(ink[i - 1]);
  expect(ink[4], `the whole logo at 1: ${ink}`).toBeGreaterThan(2000);
  // with the stagger the outline is ahead of the last bar half way
  await seek(page, 0.5);
  const k = await kernel(page, DRAW_LOGO, 0.5);
  const half = drawDashes(drawSettings((p) => k[p]), count)!;
  expect(half[0].to).toBeGreaterThan(half[count - 1].to);
});

// ---------------------------------------------------------------------------
// The new editor: the Morph & draw section
// ---------------------------------------------------------------------------

type L = { id: string; name: string; archetype: string; properties: Record<string, unknown> };
type Doc = { layers: Record<string, L>; clips: Record<string, { layerId: string; tracks: Array<{ property: string; keyframes: Array<{ time: number; value: unknown }> }> }> };
type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => Doc; commands: { addLayer: (l: unknown) => string } }; __LL_ENGINE__?: { seek: (t: number) => void } };
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_DOC__.get())) as Doc);
const props = async (page: Page, id: string) => (await doc(page)).layers[id].properties;
const track = async (page: Page, id: string, property: string) => Object.values((await doc(page)).clips).filter((c) => c.layerId === id).flatMap((c) => c.tracks).find((t) => t.property === property);
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const undo = async (page: Page) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
};

test.describe("Phase 85 in the new editor", () => {
  test.use({ viewport: { width: 1600, height: 1000 } });

  test("the Morph & draw section draws a stroke on, trims it, and morphs a path into another", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    const ids = await page.evaluate(({ menu, close }) => {
      const c = (window as unknown as Win).__LL_DOC__.commands;
      const base = { positioning: "absolute", "frame.width": 160, "frame.height": 160, "svg.stroke": "#0f172a", "svg.strokeWidth": 4, "svg.fill": "none" };
      // the icons' paths, scaled into a path layer's 200 x 200 space
      const scale = (d: string) => d.replace(/-?\d+(\.\d+)?/g, (n) => String(Number(n) * 8));
      return {
        a: c.addLayer({ archetype: "svgPath", parentId: "hero", name: "Menu path", properties: { ...base, "frame.x": 40, "frame.y": 40, "svg.path": scale(menu) } }),
        b: c.addLayer({ archetype: "svgPath", parentId: "hero", name: "Close path", properties: { ...base, "frame.x": 260, "frame.y": 40, "svg.path": scale(close) } }),
      };
    }, { menu: ICON_MENU, close: ICON_CLOSE });
    const before = await props(page, ids.a);

    await page.getByRole("tab", { name: "Motion" }).click();
    await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__);
    await page.locator(`[data-testid="stage-element"][data-element-id="${ids.a}"]`).click();
    const section = page.locator('[data-section="morph-draw"]');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();

    // draw on: two keyframes on the drawn length, the layer whole at rest, one undo step
    await set(page, "Animation length", 2);
    await page.getByRole("button", { name: "Draw stroke on", exact: true }).click();
    await expect.poll(async () => (await track(page, ids.a, "draw.end"))?.keyframes.map((k) => k.value)).toEqual([0, 1]);
    expect((await props(page, ids.a))["draw.end"]).toBe(1);
    const keys = (await track(page, ids.a, "draw.end"))!.keyframes;
    expect(keys[1].time - keys[0].time).toBeCloseTo(2, 3);

    // the stage shows it at the playhead: half way through, each of the three strokes is half drawn
    await page.evaluate((t) => (window as unknown as Win).__LL_ENGINE__!.seek(t), keys[0].time + 1);
    const parts = page.locator(`[data-testid="stage-page"] [data-element-id="${ids.a}"] path[data-path-part]`);
    await expect(parts).toHaveCount(3);
    await expect.poll(async () => parts.evaluateAll((els) => els.map((e) => e.getAttribute("stroke-dasharray")))).toEqual(["0.5 0.5", "0.5 0.5", "0.5 0.5"]);

    // the trim settings: a stagger draws the strokes one after another, so the first is ahead of the last
    await set(page, "Draw stagger", 100);
    await expect.poll(async () => (await props(page, ids.a))["draw.stagger"]).toBe(1);
    await expect.poll(async () => parts.evaluateAll((els) => els.map((e) => e.getAttribute("stroke-dasharray")))).toEqual(["1 0", "0.5 0.5", "0 2"]);
    await page.getByRole("button", { name: "Draw from the other end", exact: true }).click();
    await expect.poll(async () => (await props(page, ids.a))["draw.reverse"]).toBe(true);
    await undo(page);
    await expect.poll(async () => (await props(page, ids.a))["draw.reverse"] ?? false).toBe(false);

    // morph into the other path: two keyframes on the path, and the stage draws the kernel's morph half way
    await page.locator(`[data-testid="stage-element"][data-element-id="${ids.a}"]`).click();
    await page.evaluate((t) => (window as unknown as Win).__LL_ENGINE__!.seek(t), 0);
    await chooseOption(page, "Morph into layer", "Close path");
    await expect.poll(async () => (await track(page, ids.a, "svg.path"))?.keyframes.length).toBe(2);
    const morph = (await track(page, ids.a, "svg.path"))!.keyframes;
    expect(morph[0].value).toBe(before["svg.path"]);
    expect(morph[1].value).toBe((await props(page, ids.b))["svg.path"]);
    await page.evaluate((t) => (window as unknown as Win).__LL_ENGINE__!.seek(t), 1);
    const expected = morphPath(morph[0].value as string, morph[1].value as string, 0.5);
    await expect.poll(async () => page.locator(`[data-testid="stage-page"] [data-element-id="${ids.a}"] path[data-path-fill]`).getAttribute("d")).toBe(expected);

    // the fixes appear once the path morphs, and change the document
    await chooseOption(page, "Morph matching", "As drawn");
    await expect.poll(async () => (await props(page, ids.a))["morph.match"]).toBe("order");
    await set(page, "Morph start point", 2);
    await expect.poll(async () => (await props(page, ids.a))["morph.startOffset"]).toBe(2);
    await page.getByRole("button", { name: "Reverse morph direction", exact: true }).click();
    await expect.poll(async () => (await props(page, ids.a))["morph.reverse"]).toBe(true);

    // both animations are listed with their times, and each is removed from there (one undo step puts it back)
    await expect(section.locator('[data-path-animation="draw.end"]')).toContainText("Stroke draws on");
    await expect(section.locator('[data-path-animation="svg.path"]')).toContainText("Path morphs · 0.00s to 2.00s");
    await page.getByRole("button", { name: "Remove animation: Path morphs", exact: true }).click();
    await expect.poll(async () => track(page, ids.a, "svg.path")).toBeUndefined();
    await expect(page.getByLabel("Morph matching", { exact: true })).toHaveCount(0);
    await undo(page);
    await expect.poll(async () => (await track(page, ids.a, "svg.path"))?.keyframes.length).toBe(2);

    // trim off: the settings go, and the layer is one path again
    await page.getByRole("button", { name: "Trim stroke", exact: true }).click();
    await expect.poll(async () => (await props(page, ids.a))["draw.end"]).toBeUndefined();
  });
});
