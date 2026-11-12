/**
 * ROADMAP_3D 3D-012: The scene layer on the canvas (Phase 3D-012 & 3D-018).
 * - Inserts a 3D scene via `3d.scene.insert` through `window.__LL_COMMANDS__`.
 * - The canvas draws and has non-background pixels.
 * - Context loss is forced via WEBGL_lose_context and recovers.
 * - When scrolled off screen, the compositor reports it asleep and displays the poster.
 * - Double-click enters 3D editing mode, and Escape exits via `3d.scene.exit`.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, EDITOR_URL } from "./support/editor";

type Stats = {
  contexts: number;
  scenes: number;
  awake: number;
  asleep: number;
  waiting: number;
  losses: number;
  restores: number;
};

type Win = {
  __LL_TEST__?: boolean;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; run: (args?: unknown) => unknown }>;
    context: () => Record<string, unknown>;
  };
  __LL_COMPOSITOR__?: {
    stats: () => Stats;
    loseShared: () => void;
    restoreShared: () => void;
  };
};

async function readyEditor(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Win).__LL_TEST__ = true;
  });
  await openEditor(page, EDITOR_URL);
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_COMMANDS__);
}

test("3D-012: 3D scene layer insertion, rendering, context loss recovery, and offscreen sleep", async ({ page }) => {
  await readyEditor(page);

  // 1. Insert 3D scene via command
  await page.evaluate(() => {
    const win = window as unknown as Win;
    const insertCmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.scene.insert");
    if (!insertCmd) throw new Error("3d.scene.insert command not found in registry");
    insertCmd.run({ width: 480, height: 320 });
  });

  // 2. Layer and canvas exist in the DOM
  const layer = page.locator('[data-archetype="scene3d"]').first();
  await expect(layer).toBeVisible({ timeout: 15_000 });

  const sceneCanvas = page.locator('[data-archetype="scene3d"] canvas[data-scene-canvas]').first();
  await expect(sceneCanvas).toBeVisible();

  // Wait for canvas to draw (dataset.ready incremented by onReady)
  await expect.poll(async () => {
    return sceneCanvas.evaluate((el) => Number((el as HTMLCanvasElement).dataset.ready ?? "0"));
  }, { timeout: 15_000, message: "canvas onReady fired and rendered" }).toBeGreaterThan(0);

  // 3. Canvas has non-background pixels
  const hasPixels = await sceneCanvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const copy = document.createElement("canvas");
    copy.width = c.width;
    copy.height = c.height;
    const ctx = copy.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let opaqueCount = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) opaqueCount++;
    }
    return opaqueCount > 100;
  });
  expect(hasPixels, "the 3D canvas rendered non-background pixels").toBe(true);

  // 4. Forced context loss recovers
  const readyBefore = await sceneCanvas.evaluate((c) => Number((c as HTMLCanvasElement).dataset.ready ?? "0"));
  await sceneCanvas.evaluate((c) => {
    const gl = (c as HTMLCanvasElement).getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (!ext) throw new Error("WEBGL_lose_context unavailable");
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 50);
  });

  await expect.poll(async () => {
    return sceneCanvas.evaluate((c) => Number((c as HTMLCanvasElement).dataset.ready ?? "0"));
  }, { timeout: 3000, message: "scene drew again after context restoration" }).toBeGreaterThan(readyBefore);

  // 5. Entering 3D editing mode on double-click and leaving on Escape
  // the stage's hit box covers the layer: a person double-clicks that
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_COMMANDS__!.context().editingScene3d)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(layer).not.toHaveAttribute("data-editing-3d", "true");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_COMMANDS__!.context().editingScene3d)).toBe(false);

  // 6. When scrolled off screen, the compositor reports it asleep
  await page.evaluate(() => {
    const el = document.querySelector('[data-archetype="scene3d"]') as HTMLElement | null;
    if (el) {
      el.style.transform = "translateY(15000px)";
    }
  });

  await expect.poll(async () => {
    const stats = await page.evaluate(() => (window as unknown as Win).__LL_COMPOSITOR__?.stats());
    return stats ? stats.asleep : 0;
  }, { timeout: 10_000, message: "scene is reported asleep when off screen" }).toBeGreaterThanOrEqual(1);

  // Poster canvas is displayed
  const poster = page.locator('[data-archetype="scene3d"] canvas[data-poster]').first();
  await expect(poster).toBeVisible();
});
