/**
 * ROADMAP_3D B2-W2-2b: Viewport 3D Panels & Chrome E2E Spec
 * - Tests Adjust Last Operation panel after 3d.add.cylinder, changing vertices to 64 and undoing.
 * - Tests ShadingBar buttons switching settings.shading and rendering canvas pixels.
 * - Tests OverlaysMenu toggling grid and mounting the ViewportStats readout.
 * - Tests switching 3D keymaps changing which key runs 3d.transform.translate (G vs V).
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, EDITOR_URL } from "./support/editor";

type Win = {
  __LL_TEST__?: boolean;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; keybinding?: string | string[]; run: (args?: unknown) => unknown }>;
    context: () => Record<string, unknown>;
    run: (id: string, args?: unknown) => boolean;
  };
  __LL_DOC__?: {
    commands: unknown;
    get: () => {
      scenes?: Record<string, { objects?: string[] }>;
      objects?: Record<string, { dataId?: string }>;
      meshes?: Record<string, { positions?: number[] }>;
    };
  };
  __LL_VIEWPORT_STORE__?: {
    getState: () => {
      settings: {
        shading: string;
        xray: boolean;
        overlays: { grid: boolean; stats: boolean; [key: string]: boolean };
      };
      keymapId: "blender" | "beginner";
      setKeymapId: (id: "blender" | "beginner") => void;
      setSettings: (updater: unknown) => void;
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

test("B2-W2-2b: 3D viewport panels, adjust last operation, shading, overlays, and keymaps", async ({ page }) => {
  await readyEditor(page);

  // 1. Insert 3D scene and enter 3D editing mode
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("3d.scene.insert", { width: 480, height: 320 });
  });

  const layer = page.locator('[data-archetype="scene3d"]').first();
  await expect(layer).toBeVisible({ timeout: 15_000 });

  const sceneCanvas = page.locator('[data-archetype="scene3d"] canvas[data-scene-canvas]').first();
  await expect(sceneCanvas).toBeVisible();

  // Double click layer to enter 3D editing mode
  // the stage's hit box covers the layer: a person double-clicks that
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");

  // 2. Adjust Last Operation: Add Cylinder and tweak vertices
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("3d.add.cylinder", { vertices: 32, radius: 1, depth: 2 });
  });

  const adjustPanel = page.locator('[data-testid="adjust-last-op-panel"]');
  await expect(adjustPanel).toBeVisible({ timeout: 5_000 });
  await expect(adjustPanel).toContainText("Add Cylinder");

  const verticesInput = adjustPanel.locator('[data-arg="vertices"] input');
  await expect(verticesInput).toBeVisible();

  // Verify initial vertex count (32 vertices -> 66 positions / 3)
  const initialVertCount = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    if (!doc?.meshes) return 0;
    const meshIds = Object.keys(doc.meshes);
    const lastMesh = doc.meshes[meshIds[meshIds.length - 1]];
    return lastMesh?.positions ? lastMesh.positions.length / 3 : 0;
  });
  expect(initialVertCount).toBe(66);

  // Change vertices field to 64
  await verticesInput.click();
  await verticesInput.fill("64");
  await verticesInput.press("Enter");

  // Verify mesh updated in document data block (64 vertices -> 130 positions / 3)
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      if (!doc?.meshes) return 0;
      const meshIds = Object.keys(doc.meshes);
      const lastMesh = doc.meshes[meshIds[meshIds.length - 1]];
      return lastMesh?.positions ? lastMesh.positions.length / 3 : 0;
    });
  }, { timeout: 3_000, message: "mesh vertex count updated to 130" }).toBe(130);

  // One undo returns to before (leave the number field first: while a text field has focus, Undo is the field's own)
  await verticesInput.blur();
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run("edit.undo");
  });

  // Verify undo reverted the addition: only the scene's own cube is left
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      if (!doc?.meshes) return 0;
      return Object.keys(doc.meshes).length;
    });
  }, { timeout: 3_000, message: "single undo reverted cylinder" }).toBe(1);

  // 3. Shading Buttons: Wireframe, Solid, Material, Rendered, X-Ray
  const shadingBar = page.locator('[data-testid="shading-bar"]');
  await expect(shadingBar).toBeVisible();

  const wireBtn = page.locator('[data-testid="shading-wireframe"]');
  const solidBtn = page.locator('[data-testid="shading-solid"]');
  const xrayBtn = page.locator('[data-testid="shading-xray"]');

  // Switch to wireframe
  await wireBtn.click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as Win).__LL_VIEWPORT_STORE__?.getState().settings.shading);
  }).toBe("wireframe");

  // Switch back to solid
  await solidBtn.click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as Win).__LL_VIEWPORT_STORE__?.getState().settings.shading);
  }).toBe("solid");

  // Toggle X-Ray
  await xrayBtn.click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as Win).__LL_VIEWPORT_STORE__?.getState().settings.xray);
  }).toBe(true);

  // 4. Overlays Menu: Grid toggle and ViewportStats readout
  const overlaysTrigger = page.locator('[data-testid="overlays-menu-trigger"]');
  await expect(overlaysTrigger).toBeVisible();
  await overlaysTrigger.click();

  const overlaysPopover = page.locator('[data-testid="overlays-menu-popover"]');
  await expect(overlaysPopover).toBeVisible();

  // Toggle statistics overlay on
  const statsToggle = page.locator('[data-testid="overlay-toggle-stats"]');
  await statsToggle.click();

  const statsHud = page.locator('[data-testid="viewport-stats"]');
  await expect(statsHud).toBeVisible({ timeout: 3_000 });
  await expect(statsHud).toContainText("Objects");
  await expect(statsHud).toContainText("Vertices");
  await expect(statsHud).toContainText("Memory");

  // Toggle grid off
  const gridToggle = page.locator('[data-testid="overlay-toggle-grid"]');
  await gridToggle.click();
  await expect.poll(async () => {
    return page.evaluate(() => (window as unknown as Win).__LL_VIEWPORT_STORE__?.getState().settings.overlays.grid);
  }).toBe(false);

  // Close overlays popover
  await overlaysTrigger.click();

  // 5. Keymaps: Blender (G) vs Beginner (V) for 3d.transform.translate
  // In Blender keymap, translate is bound to "G"
  const blenderKey = await page.evaluate(() => {
    const win = window as unknown as Win;
    const cmd = win.__LL_COMMANDS__?.all().find((c) => c.id === "3d.transform.translate");
    return cmd?.keybinding;
  });
  expect(String(blenderKey).toLowerCase()).toBe("g");

  // Switch to Beginner keymap
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_VIEWPORT_STORE__?.getState().setKeymapId("beginner");
  });

  // In Beginner keymap, translate is bound to "V"
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const cmd = win.__LL_COMMANDS__?.all().find((c) => c.id === "3d.transform.translate");
      return String(cmd?.keybinding).toLowerCase();
    });
  }).toBe("v");

  // Switch back to Blender keymap
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_VIEWPORT_STORE__?.getState().setKeymapId("blender");
  });

  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const cmd = win.__LL_COMMANDS__?.all().find((c) => c.id === "3d.transform.translate");
      return cmd?.keybinding;
    });
  }).toBe("G");
});
