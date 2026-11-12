/**
 * ============================================================================
 * 3D OUTLINER E2E SPEC (ROADMAP_3D Phases 3D-021, 3D-024, 3D-029)
 * ============================================================================
 * - Inserts a 3D scene via `3d.scene.insert` through command seam.
 * - Enters 3D editing mode via canvas double-click.
 * - Verifies Outliner in Layers panel displays Cube, Camera, and Light rows.
 * - Toggles visibility of the cube using the eye button.
 * - Adds a cylinder and drags it onto the cube row to reparent with world transform preserved.
 * - Renames the object via double-click.
 * - Runs Make 3D on a 2D layer to add a new 3D object to the scene.
 * ============================================================================
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor, EDITOR_URL } from "./support/editor";

type Win = {
  __LL_TEST__?: boolean;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; run: (args?: unknown) => unknown }>;
    context: () => Record<string, unknown>;
    run: (id: string, args?: unknown) => boolean;
  };
  __LL_DOC__?: {
    commands: {
      addLayer?: (layer: unknown) => string;
      updateProps?: (id: string, patch: Record<string, unknown>) => void;
    };
    get: () => {
      scenes?: Record<string, { objects?: string[] }>;
      objects?: Record<
        string,
        {
          id: string;
          name?: string;
          visible?: boolean;
          parentId?: string | null;
          transform?: { location?: [number, number, number] };
        }
      >;
      layers?: Record<string, { id: string; name?: string; archetype?: string; parentId?: string | null }>;
    };
  };
  __LL_VIEWPORT_STORE__?: {
    getState: () => {
      editingSceneId: string | null;
      selection: { active: string | null; selected: readonly string[] };
      setEditingSceneId: (id: string | null) => void;
    };
  };
};

async function readyEditor(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as Win).__LL_TEST__ = true;
  });
  await openEditor(page, EDITOR_URL);
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_COMMANDS__);
}

test("3D-021 & 3D-024 & 3D-029: Outliner in Layers panel, reparenting, renaming, and Make 3D", async ({ page }) => {
  await readyEditor(page);

  // 1. Insert 3D scene via command seam
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("3d.scene.insert", { width: 480, height: 320 });
  });

  const layer = page.locator('[data-archetype="scene3d"]').first();
  await expect(layer).toBeVisible({ timeout: 15_000 });

  const sceneCanvas = page.locator('[data-archetype="scene3d"] canvas[data-scene-canvas]').first();
  await expect(sceneCanvas).toBeVisible();

  // 2. Enter 3D editing mode by double-clicking the stage element
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");

  // 3. Outliner tree renders in the Layers panel with Cube, Camera, and Light rows
  const outliner = page.locator('[data-testid="outliner-3d"]');
  await expect(outliner).toBeVisible({ timeout: 10_000 });

  const cubeRow = outliner.locator('[data-testid="outliner-row"]').filter({ hasText: "Cube" }).first();
  const cameraRow = outliner.locator('[data-testid="outliner-row"]').filter({ hasText: "Camera" }).first();
  const lightRow = outliner.locator('[data-testid="outliner-row"]').filter({ hasText: "Light" }).first();

  await expect(cubeRow).toBeVisible();
  await expect(cameraRow).toBeVisible();
  await expect(lightRow).toBeVisible();

  // 4. Hide the cube with its eye and verify the viewport store / document flag changes
  const eyeBtn = cubeRow.locator('[data-testid="outliner-toggle-eye"]');
  await eyeBtn.click();

  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      if (!doc?.objects) return null;
      const cubeObj = Object.values(doc.objects).find((o) => o.name === "Cube");
      return cubeObj?.visible;
    });
  }, { timeout: 5_000, message: "Cube visibility updated to false in document" }).toBe(false);

  // 5. Add a cylinder and drag it onto the cube row
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("3d.add.cylinder", { radius: 1, depth: 2 });
  });

  const cylRow = outliner.locator('[data-testid="outliner-row"]').filter({ hasText: "Cylinder" }).first();
  await expect(cylRow).toBeVisible({ timeout: 5_000 });

  // Record cylinder world location before reparenting
  const cylLocBefore = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    const cyl = Object.values(doc?.objects ?? {}).find((o) => o.name?.includes("Cylinder"));
    return cyl?.transform?.location ? [...cyl.transform.location] : [0, 0, 0];
  });

  // Drag cylinder onto cube row to reparent
  await cylRow.dragTo(cubeRow);

  // Verify cylinder's parent becomes the cube
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const cube = Object.values(doc?.objects ?? {}).find((o) => o.name === "Cube");
      const cyl = Object.values(doc?.objects ?? {}).find((o) => o.name?.includes("Cylinder"));
      return cyl?.parentId === cube?.id;
    });
  }, { timeout: 5_000, message: "Cylinder parentId set to Cube id" }).toBe(true);

  // Verify world position is unchanged within float tolerance
  const cylLocAfter = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    const cyl = Object.values(doc?.objects ?? {}).find((o) => o.name?.includes("Cylinder"));
    return cyl?.transform?.location ? [...cyl.transform.location] : null;
  });
  expect(cylLocAfter).not.toBeNull();
  expect(Math.abs((cylLocAfter?.[0] ?? 0) - cylLocBefore[0])).toBeLessThan(0.01);
  expect(Math.abs((cylLocAfter?.[1] ?? 0) - cylLocBefore[1])).toBeLessThan(0.01);
  expect(Math.abs((cylLocAfter?.[2] ?? 0) - cylLocBefore[2])).toBeLessThan(0.01);

  // 6. Rename by double-click
  const cylLabel = cylRow.locator('[data-testid="outliner-row-label"]');
  await cylLabel.dblclick();

  // once renaming starts the label becomes an input, so the row no longer matches its old text: find the input itself
  const renameInput = page.locator('[data-testid="outliner-3d"] [data-testid="outliner-rename-input"]');
  await expect(renameInput).toBeVisible({ timeout: 3_000 });
  await renameInput.fill("Pillar");
  await renameInput.press("Enter");

  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      return Object.values(doc?.objects ?? {}).some((o) => o.name === "Pillar");
    });
  }, { timeout: 5_000, message: "Object renamed to Pillar" }).toBe(true);

  // 7. Make 3D on a rectangle layer adds an object
  await page.keyboard.press("Escape");

  const rectId = await page.evaluate(() => {
    const win = window as unknown as Win;
    const root = Object.values(win.__LL_DOC__!.get().layers ?? {}).find((l) => l.parentId === null);
    return win.__LL_DOC__!.commands.addLayer!({
      name: "Badge",
      archetype: "rectangle",
      parentId: root?.id ?? null,
      properties: {
        "frame.width": 120,
        "frame.height": 60,
        "paint.fill": "#4f46e5",
      },
    });
  });

  const objectsBeforeCount = await page.evaluate(() => {
    const win = window as unknown as Win;
    return Object.keys(win.__LL_DOC__?.get().objects ?? {}).length;
  });

  // Run Make 3D command seam
  await page.evaluate((id) => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("3d.make3d.from_layer", { layerId: id, mode: "extrude" });
  }, rectId);

  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      return Object.keys(win.__LL_DOC__?.get().objects ?? {}).length;
    });
  }, { timeout: 5_000, message: "Make 3D created a new 3D object in the document" }).toBeGreaterThan(objectsBeforeCount);
});
