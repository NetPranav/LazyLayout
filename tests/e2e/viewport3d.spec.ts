/**
 * ROADMAP_3D Phase 3D-014 – 3D-017: Viewport Interaction Layer.
 * Spec journey (Task B2-W2-2a):
 *   1. Insert a 3D scene via `3d.scene.insert`.
 *   2. Double-click to enter 3D editing mode.
 *   3. Orbit camera by dragging with the middle button.
 *   4. Press `3d.view.top` via command seam and verify store's camera view matrix.
 *   5. Click the cube centre and see it selected.
 *   6. Type G, X, 2, Enter to move it exactly 2 m in X.
 *   7. Ctrl+Z undoes in one step.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, EDITOR_URL } from "./support/editor";

type Win = {
  __LL_TEST__?: boolean;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; run: (args?: unknown) => unknown }>;
    context: () => Record<string, unknown>;
  };
  __LL_VIEWPORT_STORE__?: {
    getState: () => {
      camera: {
        yaw: number;
        pitch: number;
        fovY: number;
        distance: number;
        target: [number, number, number];
        ortho: boolean;
      };
      selection: {
        active: string | null;
        selected: string[];
      };
      editingSceneId: string | null;
    };
  };
  __LL_DOC__?: {
    get: () => {
      objects?: Record<string, {
        id: string;
        name: string;
        transform: {
          location: [number, number, number];
          rotationQuat: [number, number, number, number];
          scale: [number, number, number];
        };
      }>;
    };
    commands: {
      undo: () => boolean;
      redo: () => boolean;
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

test("3D-014..3D-017: Viewport interaction, camera navigation, top view, picking, modal G/X/2, and undo", async ({
  page,
}) => {
  await readyEditor(page);

  // 1. Insert 3D scene via command seam
  await page.evaluate(() => {
    const win = window as unknown as Win;
    const insertCmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.scene.insert");
    if (!insertCmd) throw new Error("3d.scene.insert command not found in registry");
    insertCmd.run({ width: 480, height: 320 });
  });

  const layer = page.locator('[data-archetype="scene3d"]').first();
  await expect(layer).toBeVisible({ timeout: 15_000 });

  const sceneCanvas = page.locator('[data-archetype="scene3d"] canvas[data-scene-canvas]').first();
  await expect(sceneCanvas).toBeVisible();

  // Wait for canvas to be ready and rendered
  await expect.poll(async () => {
    return sceneCanvas.evaluate((el) => Number((el as HTMLCanvasElement).dataset.ready ?? "0"));
  }, { timeout: 15_000, message: "canvas onReady rendered" }).toBeGreaterThan(0);

  // 2. Double-click layer to enter 3D editing mode
  // the stage's hit box covers the layer: a person double-clicks that
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__LL_COMMANDS__!.context().editingScene3d)).toBe(true);

  const interactionLayer = page.locator('[data-testid="viewport-interaction"]').first();
  await expect(interactionLayer).toBeVisible();

  const box = await layer.boundingBox();
  expect(box).not.toBeNull();
  const centerX = box!.x + box!.width / 2;
  const centerY = box!.y + box!.height / 2;

  // 3. Orbit camera by dragging with the middle button (button 1)
  const camBeforeOrbit = await page.evaluate(() => {
    const win = window as unknown as Win;
    return win.__LL_VIEWPORT_STORE__?.getState().camera;
  });
  expect(camBeforeOrbit).toBeDefined();

  await page.mouse.move(centerX, centerY);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(centerX + 60, centerY + 40, { steps: 5 });
  await page.mouse.up({ button: "middle" });

  await expect.poll(async () => {
    const camAfter = await page.evaluate(() => {
      const win = window as unknown as Win;
      return win.__LL_VIEWPORT_STORE__?.getState().camera;
    });
    return camAfter?.yaw !== camBeforeOrbit?.yaw || camAfter?.pitch !== camBeforeOrbit?.pitch;
  }, { timeout: 5000, message: "camera rotated via middle mouse drag" }).toBe(true);

  // 4. Press 3d.view.top via command seam and verify store's camera orientation
  await page.evaluate(() => {
    const win = window as unknown as Win;
    const topCmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.view.top");
    if (!topCmd) throw new Error("3d.view.top command not found in registry");
    topCmd.run();
  });

  await expect.poll(async () => {
    const cam = await page.evaluate(() => {
      const win = window as unknown as Win;
      return win.__LL_VIEWPORT_STORE__?.getState().camera;
    });
    // Top view has yaw = 0 and pitch = PITCH_LIMIT (close to Math.PI / 2)
    const yawClose = Math.abs(cam?.yaw ?? 1) < 1e-2;
    const pitchTop = (cam?.pitch ?? 0) > 1.5;
    return yawClose && pitchTop;
  }, { timeout: 5000, message: "camera set to standard top view" }).toBe(true);

  // 5. Click the cube centre and see it selected
  await page.mouse.click(centerX, centerY);

  await expect.poll(async () => {
    const sel = await page.evaluate(() => {
      const win = window as unknown as Win;
      return win.__LL_VIEWPORT_STORE__?.getState().selection;
    });
    return sel?.selected.length ?? 0;
  }, { timeout: 5000, message: "cube is selected after clicking center" }).toBeGreaterThanOrEqual(1);

  // 6. Modal G, X, 2, Enter moves it exactly 2 m in X
  await interactionLayer.focus();
  await page.keyboard.press("g");
  await page.keyboard.press("x");
  await page.keyboard.press("2");
  await page.keyboard.press("Enter");

  await expect.poll(async () => {
    const doc = await page.evaluate(() => {
      const win = window as unknown as Win;
      return win.__LL_DOC__?.get();
    });
    const cubeObj = Object.values(doc?.objects ?? {}).find((o) => o.name === "Cube");
    return cubeObj?.transform.location[0];
  }, { timeout: 5000, message: "cube moved exactly 2m along X" }).toBeCloseTo(2.0, 1);

  // 7. Ctrl+Z undoes in one step
  await page.keyboard.press("ControlOrMeta+z");

  await expect.poll(async () => {
    const doc = await page.evaluate(() => {
      const win = window as unknown as Win;
      return win.__LL_DOC__?.get();
    });
    const cubeObj = Object.values(doc?.objects ?? {}).find((o) => o.name === "Cube");
    return cubeObj?.transform.location[0];
  }, { timeout: 5000, message: "cube location reverted to 0 after 1 undo step" }).toBeCloseTo(0.0, 1);
});
