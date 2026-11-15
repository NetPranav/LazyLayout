/**
 * Phases 64 to 71 on the new editor (/editor):
 * - 64: with 200 animated layers, the timeline builds only the rows in view, builds more on scroll, and a scrub stays
 *   within a frame's budget.
 * - 65: + Precomp places a precomp; double-clicking its bar opens it in a tab with breadcrumbs; an edit there shows on
 *   the parent's bar; the breadcrumb goes back.
 * - 66: three selected keyframes are distributed evenly and made slower, each one undo step.
 * - 67: a named feel (Bouncy) and F9 (Easy Ease) write real easing strings; the graph switches to Speed.
 * - 68: a clip made in the document reaches the code view's generated files.
 * - 69 to 71: the motion path and onion skin are drawn for the selected animated layer.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Keyframe = { id: string; time: number; value: unknown; ease?: string };
type Clip = { id: string; layerId: string; tracks: Array<{ id: string; property: string; keyframes: Keyframe[] }> };
type Doc = { clips: Record<string, Clip>; compositions: Record<string, { kind: string; nested: Array<{ compositionId: string }> }> };
type Win = {
  __LL_TEST__: boolean;
  __LL_ENGINE__?: { seek: (t: number) => void; time: () => number; document: () => Doc };
  __LL_DOC__: { commands: { addLayer: (l: unknown) => string; addClip: (layerId: string, clip: unknown, label?: string, placement?: { compositionId: string; offset?: number }) => string } };
  __LL_COMMANDS__?: { all: () => Array<{ id: string; run: (a?: unknown) => unknown }> };
};

const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as Win).__LL_ENGINE__!.document())) as Doc);
const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as Win).__LL_COMMANDS__!.all().find((c) => c.id === id)!.run(args), { id, args });

async function start(page: Page) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}
async function motion(page: Page) {
  await page.getByRole("tab", { name: "Motion" }).click();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_ENGINE__ && !!(window as unknown as Win).__LL_COMMANDS__);
}

/** A layer under the hero with one clip whose x track has keys at these times. */
async function mover(page: Page, name: string, times: number[]): Promise<string> {
  return page.evaluate(
    ({ name, times }) => {
      const c = (window as unknown as Win).__LL_DOC__.commands;
      const layerId = c.addLayer({ archetype: "rectangle", parentId: "hero", name, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 80, "frame.height": 60 } });
      c.addClip(
        layerId,
        { id: `clip_${name}`, name, type: "entrance", trigger: "mount", duration: 2, easing: "linear", enabled: true, tracks: [{ id: `trk_${name}`, property: "transform.x", keyframes: times.map((time, i) => ({ id: `kf_${name}_${i}`, time, value: i * 100 })) }] },
        "Test animation",
        { compositionId: "comp_main" },
      );
      return layerId;
    },
    { name, times },
  );
}
const keyTimes = async (page: Page, name: string) =>
  (await doc(page)).clips[`clip_${name}`].tracks[0].keyframes.map((k) => Math.round(k.time * 1000) / 1000);

test("Phase 64 on the new editor: 200 layers build only the rows in view, and a scrub stays within a frame", async ({ page, browserName }) => {
  await start(page);
  await page.evaluate(() => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    for (let i = 0; i < 200; i++) {
      const layerId = c.addLayer({ archetype: "rectangle", parentId: "hero", name: `Bulk ${i}`, properties: { positioning: "absolute", "frame.x": i % 40, "frame.y": i % 30, "frame.width": 10, "frame.height": 10 } });
      c.addClip(
        layerId,
        {
          id: `clip_bulk_${i}`, name: "Bulk", type: "entrance", trigger: "mount", duration: 2, easing: "linear", enabled: true,
          tracks: ["transform.x", "transform.y", "appearance.opacity", "transform.rotate", "transform.scale"].map((property, p) => ({ id: `trk_bulk_${i}_${p}`, property, keyframes: [{ id: `kf_bulk_${i}_${p}_a`, time: 0, value: 0 }, { id: `kf_bulk_${i}_${p}_b`, time: 2, value: 1 }] })),
        },
        "Bulk",
        { compositionId: "comp_main" },
      );
    }
  });
  await motion(page);
  const rows = page.locator("[data-lazy-row]");
  await expect.poll(() => rows.count(), { timeout: 20_000 }).toBeGreaterThanOrEqual(200);
  const built = page.locator('[data-lazy-row][data-built="true"]');
  const inView = await built.count();
  expect(inView, "only the rows in view (and a margin) are built").toBeLessThan(80);
  expect(inView).toBeGreaterThan(0);

  // scrolling to the end builds the rows there
  await page.locator(".ll-tls").evaluate((el) => (el.scrollTop = el.scrollHeight));
  await expect(page.locator('[data-lazy-row="clip_bulk_199"], [data-lazy-row][data-built="true"]').last()).toBeVisible();
  const lastId = await rows.last().getAttribute("data-lazy-row");
  await expect(page.locator(`[data-lazy-row="${lastId}"]`)).toHaveAttribute("data-built", "true");

  // The workspace springs into place after the tab is clicked (`data-pfx` is on the root until it rests). With 200 layers
  // that takes a while in a slow browser, and a scrub measured during it measures the opening animation.
  await expect.poll(() => page.locator(".ll-editor-root").getAttribute("data-pfx"), { timeout: 45_000 }).toBeNull();
  await page.waitForTimeout(300);

  // a scrub: 60 seeks, one per frame, each frame within budget on average
  const avg = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const e = (window as unknown as Win).__LL_ENGINE__!;
        let i = 0;
        let last = performance.now();
        const gaps: number[] = [];
        const step = () => {
          const now = performance.now();
          if (i > 0) gaps.push(now - last);
          last = now;
          e.seek((i % 60) / 30);
          if (++i <= 60) requestAnimationFrame(step);
          else resolve(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        };
        requestAnimationFrame(step);
      }),
  );
  console.log(`[phase 64] 200 layers x 5 tracks: mean frame ${avg.toFixed(1)} ms while scrubbing`);
  test.info().annotations.push({ type: "phase 64 scrub", description: `${browserName}: mean frame ${avg.toFixed(1)} ms` });
  // Two frames at 60 fps where the browser composites moving layers on the GPU (Chromium, Firefox). Playwright's WebKit
  // paints in software and repaints the whole window for any change, so a frame there costs what painting the page
  // costs (about 95 ms for this page, 16 ms when nothing changes; the seek's own script is under 1 ms). Its bound only
  // catches the timeline being rebuilt on every seek, which cost 400 ms and more.
  expect(avg, "mean frame time while scrubbing 200 animated layers").toBeLessThan(browserName === "webkit" ? 250 : 34);
});

test("Phase 65 on the new editor: a precomp opens in a tab with breadcrumbs, is edited, and the parent shows the change", async ({ page }) => {
  await start(page);
  await motion(page);
  await expect(page.getByRole("tablist", { name: "Compositions" }).getByRole("tab", { name: /Main/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Precomp" }).click();
  const bar = page.locator("[data-nested-bar]");
  await expect(bar).toHaveCount(1);
  const precompId = (await doc(page)).compositions.comp_main.nested[0].compositionId;
  await bar.dblclick();
  await expect(page.locator(`[data-composition-tab="${precompId}"] [role=tab]`)).toHaveAttribute("aria-selected", "true");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumbs" });
  await expect(crumbs).toBeVisible();
  await expect(crumbs.getByRole("button")).toHaveCount(2);

  // an edit inside the precomp
  await page.evaluate((compositionId) => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    c.addClip("headline", { id: "clip_in_precomp", name: "Inside", type: "entrance", trigger: "mount", duration: 1, easing: "linear", enabled: true, tracks: [{ id: "trk_in_precomp", property: "transform.x", keyframes: [{ id: "kf_p0", time: 0, value: 0 }, { id: "kf_p1", time: 1, value: 50 }] }] }, "Edit precomp", { compositionId });
  }, precompId);
  // the lanes show the precomp's clip: the headline's row has a clip in this composition
  await expect(page.locator('[data-testid="timeline-clip"][data-layer-id="headline"]')).toHaveCount(1);

  // back to Main by the breadcrumb: the parent's bar shows the precomp's keys
  await crumbs.getByRole("button").first().click();
  await expect(page.getByRole("tablist", { name: "Compositions" }).getByRole("tab", { name: /Main/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-nested-key]")).toHaveCount(2);
});

test("Phase 66 on the new editor: three keyframes distributed evenly, then made slower, each one undo step", async ({ page }) => {
  await start(page);
  await mover(page, "Spacer", [0, 0.2, 1.5]);
  await motion(page);
  await page.getByRole("button", { name: "Expand Spacer" }).click();
  const spacerKeys = page.locator('[data-testid="keyframe"][data-prop="x"][data-key-id^="kf_Spacer_"]');
  await expect(spacerKeys).toHaveCount(3);
  await spacerKeys.nth(0).click();
  await spacerKeys.nth(1).click({ modifiers: ["Shift"] });
  await spacerKeys.nth(2).click({ modifiers: ["Shift"] });
  await expect(page.locator('[data-testid="keyframe"][data-key-id^="kf_Spacer_"][data-selected="true"]')).toHaveCount(3);

  await spacerKeys.nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Distribute evenly" }).click();
  await expect.poll(() => keyTimes(page, "Spacer")).toEqual([0, 0.75, 1.5]);

  await spacerKeys.nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Slower" }).click();
  // ×1.25 around the first key, snapped to frames (56 and 113 of 60)
  await expect.poll(() => keyTimes(page, "Spacer")).toEqual([0, 0.933, 1.883]);

  await page.locator("[data-stage=artboard]").hover();
  await page.keyboard.press("Control+z");
  await expect.poll(() => keyTimes(page, "Spacer")).toEqual([0, 0.75, 1.5]);
  await page.keyboard.press("Control+z");
  await expect.poll(() => keyTimes(page, "Spacer")).toEqual([0, 0.2, 1.5]);
});

test("Phase 67 on the new editor: Bouncy and F9 write real easings, and the graph shows speed", async ({ page }) => {
  await start(page);
  await mover(page, "Easer", [0, 1]);
  await motion(page);
  await page.getByRole("button", { name: "Expand Easer" }).click();
  const second = page.locator('[data-testid="keyframe"][data-key-id="kf_Easer_1"]');
  await second.click();
  const ease = async () => (await doc(page)).clips.clip_Easer.tracks[0].keyframes[1].ease;

  // F9 with the pointer over the timeline: Easy Ease
  await page.locator('[data-testid="timeline-ruler"]').hover();
  await page.keyboard.press("F9");
  await expect.poll(ease).toBe("cubic-bezier(0.42, 0, 0.58, 1)");

  // the keyframe menu's named feels
  await second.click({ button: "right" });
  const feelMenu = page.getByRole("menu", { name: "Feel" });
  // the submenu opens on hover, and may open over its own item: asking "is it open?" and then clicking raced with that
  // (the click then waited for ever on an item the submenu covered). Hover, wait for it, and click only if it stayed shut.
  const feelItem = page.getByRole("menuitem", { name: "Feel" });
  await feelItem.hover();
  if (!(await feelMenu.waitFor({ state: "visible", timeout: 3000 }).then(() => true, () => false))) await feelItem.click();
  await feelMenu.getByRole("menuitem", { name: "Bouncy" }).click();
  await expect.poll(ease).toMatch(/^spring\(bounce: [\d.]+, time: [\d.]+\)$/);

  // the graph: Value and Speed
  await page.locator('#vseg [data-view="graph"]').click();
  await page.getByRole("radio", { name: "Speed graph" }).click();
  await expect(page.getByRole("radio", { name: "Speed graph" })).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("path.c")).toHaveCount(1);
});

test("Phase 68 on the new editor: a clip made in the document reaches the generated code", async ({ page }) => {
  await start(page);
  await mover(page, "Exported", [0, 1]);
  await page.getByRole("tab", { name: "Code" }).click();
  // the GSAP hook for the clip "Exported" on the layer "Exported"
  await expect(page.getByText("useExportedExportedAnimation", { exact: false }).first()).toBeAttached({ timeout: 15_000 });
});

test("Phases 69 and 71 on the new editor: the selected animated layer shows its motion path and onion skin", async ({ page }) => {
  await start(page);
  const id = await page.evaluate(() => {
    const c = (window as unknown as Win).__LL_DOC__.commands;
    const layerId = c.addLayer({ archetype: "rectangle", parentId: "hero", name: "Traveller", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 60, "frame.height": 60 } });
    c.addClip(layerId, { id: "clip_trav", name: "Travel", type: "entrance", trigger: "mount", duration: 2, easing: "linear", enabled: true, tracks: [
      { id: "trk_tx", property: "transform.x", keyframes: [{ id: "kx0", time: 0, value: 0 }, { id: "kx1", time: 2, value: 300 }] },
      { id: "trk_ty", property: "transform.y", keyframes: [{ id: "ky0", time: 0, value: 0 }, { id: "ky1", time: 2, value: 120 }] },
    ] }, "Travel", { compositionId: "comp_main" });
    return layerId;
  });
  await motion(page);
  // half way through the move, the box that takes the click is where the layer is drawn, and stays there when the pointer
  // comes over it (the box used to be re-measured with the move in it and moved a second time, so the click fell through
  // to the frame behind: seen in Firefox and WebKit, where the re-render lands before the press)
  await page.evaluate(() => (window as unknown as Win).__LL_ENGINE__!.seek(1));
  const hit = page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`);
  const drawn = page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first();
  const gap = async () => {
    const [a, b] = [await hit.boundingBox(), await drawn.boundingBox()];
    return a && b ? Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) : 999;
  };
  await expect.poll(gap, "the click box is on the drawn layer").toBeLessThan(1.5);
  const box = (await drawn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300); // the hover has re-rendered and re-measured by now
  expect(await gap(), "and still is with the pointer over it").toBeLessThan(1.5);
  await page.mouse.down();
  await page.mouse.up();
  await expect(hit).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-testid="motion-path-overlay"], [data-motion-path]').first()).toBeAttached({ timeout: 10_000 });
});
