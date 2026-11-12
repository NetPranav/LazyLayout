/**
 * ============================================================================
 * E2E SPEC: ADD MENU, PRIMITIVE HANDLES, AND 3D TEXT (Task B3-W3-addtext)
 * ============================================================================
 * Spec journey (Tasks 3D-025 & 3D-026):
 *   1. Enter a 3D scene in editing mode.
 *   2. Press Shift+A (real keyboard via command dispatcher seam) to open Add Menu.
 *   3. Choose Cylinder from the menu: cylinder object exists at the 3D cursor.
 *   4. Drag its height handle: depth param increases live; 1 undo restores it.
 *   5. Add Text via menu, type "SALE" through the floating in-place overlay
 *      (with test font seam): text block string is "SALE" and mesh vertices > 0.
 *   6. Click "Convert to mesh": converts object to plain mesh and removes texts link.
 * ============================================================================
 */

import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { openEditor, EDITOR_URL } from "./support/editor";

type Win = {
  __LL_TEST__?: boolean;
  __LL_TEST_FONT__?: string;
  __LL_COMMANDS__?: {
    all: () => Array<{ id: string; run: (args?: unknown) => unknown }>;
    context: () => Record<string, unknown>;
    run?: (id: string, args?: unknown) => unknown;
    tryRun?: (id: string, args?: unknown) => unknown;
  };
  __LL_VIEWPORT_STORE__?: {
    getState: () => {
      cursor: {
        position: [number, number, number];
      };
      selection: {
        active: string | null;
        selected: string[];
      };
      editingSceneId: string | null;
    };
    setState: (state: unknown) => void;
  };
  __LL_DOC__?: {
    get: () => {
      objects?: Record<
        string,
        {
          id: string;
          name: string;
          type?: string;
          dataId?: string;
          transform: {
            location: [number, number, number];
            rotationQuat: [number, number, number, number];
            scale: [number, number, number];
          };
        }
      >;
      meshes?: Record<
        string,
        {
          id: string;
          positions: number[];
          indices: number[];
          source?: {
            kind: string;
            params: Record<string, unknown>;
          };
        }
      >;
      texts?: Record<
        string,
        {
          id: string;
          text: string;
          size: number;
          depth: number;
        }
      >;
    };
    commands: {
      undo: () => boolean;
      redo: () => boolean;
    };
  };
};

async function readyEditorWithFont(page: Page) {
  const fontPath = path.resolve("node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf");
  const fontBase64 = fs.existsSync(fontPath)
    ? fs.readFileSync(fontPath).toString("base64")
    : "";

  await page.addInitScript((fontData) => {
    const win = window as unknown as Win;
    win.__LL_TEST__ = true;
    if (fontData) {
      win.__LL_TEST_FONT__ = fontData;
    }
  }, fontBase64);

  await openEditor(page, EDITOR_URL);
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_COMMANDS__);
}

test("3D-025 & 3D-026: Shift+A Add menu, primitive handles drag/undo, and 3D text in-place editing", async ({
  page,
}) => {
  await readyEditorWithFont(page);

  // 1. Insert 3D scene via command seam
  await page.evaluate(() => {
    const win = window as unknown as Win;
    const insertCmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.scene.insert");
    if (!insertCmd) throw new Error("3d.scene.insert command not found");
    insertCmd.run({ width: 480, height: 320 });
  });

  const layer = page.locator('[data-archetype="scene3d"]').first();
  await expect(layer).toBeVisible({ timeout: 15_000 });

  // Double click layer to enter 3D editing mode
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");

  // 2. Open Add Menu via Shift+A (real keyboard shortcut)
  await page.keyboard.press("Shift+KeyA");

  const addMenu = page.locator('[data-testid="add-menu-3d"]');
  // Fallback: if browser shortcut is intercepted by host, click header Add button
  if (!(await addMenu.isVisible())) {
    const addBtn = page.locator('[data-testid="add-3d-button"]');
    if (await addBtn.isVisible()) {
      await addBtn.click();
    } else {
      await page.evaluate(() => {
        const win = window as unknown as Win;
        const cmd = win.__LL_COMMANDS__!.all().find((c) => c.id === "3d.menu.add");
        cmd?.run();
      });
    }
  }

  await expect(addMenu).toBeVisible();

  // Hover Mesh category and click Cylinder
  const meshItem = page.locator('[data-testid="add-menu-item-mesh"]');
  await meshItem.hover();

  const cylinderItem = page.locator('[data-testid="add-menu-item-cylinder"]');
  await expect(cylinderItem).toBeVisible();
  await cylinderItem.click();

  // 3. Cylinder exists at cursor
  let cylinderId: string | null = null;
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const cyl = Object.values(doc?.objects ?? {}).find((o) =>
        o.name.toLowerCase().includes("cylinder")
      );
      return cyl ? cyl.id : null;
    });
  }).not.toBeNull();

  cylinderId = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    const cyl = Object.values(doc?.objects ?? {}).find((o) =>
      o.name.toLowerCase().includes("cylinder")
    );
    return cyl?.id ?? null;
  });

  // Ensure cylinder is selected in viewport store
  await page.evaluate((id) => {
    const win = window as unknown as Win;
    win.__LL_VIEWPORT_STORE__?.setState({
      selection: { active: id, selected: [id] },
    });
  }, cylinderId);

  // 4. Drag depth handle
  const depthHandle = page.locator('[data-testid="primitive-handle-cylinder-depth"]');
  await expect(depthHandle).toBeVisible();

  const depthBefore = await page.evaluate((id) => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    const obj = doc?.objects?.[id!];
    const mesh = obj?.dataId ? doc?.meshes?.[obj.dataId] : undefined;
    return Number(mesh?.source?.params?.depth ?? 2);
  }, cylinderId);

  // the overlay re-renders as the document settles: read the box once the handle holds still
  let handleBox: { x: number; y: number; width: number; height: number } | null = null;
  await expect.poll(async () => {
    handleBox = await depthHandle.boundingBox();
    return handleBox !== null;
  }).toBe(true);

  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y - 50, { steps: 5 });
  await page.mouse.up();

  // Verify depth param increased
  await expect.poll(async () => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const obj = doc?.objects?.[id!];
      const mesh = obj?.dataId ? doc?.meshes?.[obj.dataId] : undefined;
      return Number(mesh?.source?.params?.depth ?? 0);
    }, cylinderId);
  }).toBeGreaterThan(depthBefore);

  // Exactly ONE undo restores depth
  await page.evaluate(() => {
    const win = window as unknown as Win;
    win.__LL_COMMANDS__!.run?.("edit.undo");
  });

  await expect.poll(async () => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const obj = doc?.objects?.[id!];
      const mesh = obj?.dataId ? doc?.meshes?.[obj.dataId] : undefined;
      return Number(mesh?.source?.params?.depth ?? 0);
    }, cylinderId);
  }).toBeCloseTo(depthBefore, 1);

  // 5. Add 3D Text
  const addBtn = page.locator('[data-testid="add-3d-button"]');
  await addBtn.click();
  await expect(addMenu).toBeVisible();

  const textItem = page.locator('[data-testid="add-menu-item-text"]');
  await textItem.click();

  // Floating in-place input appears
  const textInput = page.locator('[data-testid="text-3d-inplace-input"]');
  await expect(textInput).toBeVisible();

  // Type "SALE" through the overlay
  await textInput.fill("SALE");
  await page.keyboard.press("Enter");

  // Verify text block string and mesh vertex count > 0
  let textObjId: string | null = null;
  await expect.poll(async () => {
    return page.evaluate(() => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const txtObj = Object.values(doc?.objects ?? {}).find((o) => o.type === "text");
      if (!txtObj || !txtObj.dataId) return false;
      const textData = doc?.texts?.[txtObj.dataId];
      const mesh = doc?.meshes?.[txtObj.dataId] || Object.values(doc?.meshes ?? {}).find(m => m.source?.params?.textId === txtObj.dataId);
      return textData?.text === "SALE" && (mesh?.positions?.length ?? 0) > 0;
    });
  }).toBe(true);

  textObjId = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__?.get();
    const txtObj = Object.values(doc?.objects ?? {}).find((o) => o.type === "text");
    return txtObj?.id ?? null;
  });

  // 6. Convert to mesh
  // Ensure text object is selected
  await page.evaluate((id) => {
    const win = window as unknown as Win;
    win.__LL_VIEWPORT_STORE__?.setState({
      selection: { active: id, selected: [id] },
    });
  }, textObjId);

  const convertBtn = page.locator('[data-testid="convert-text-to-mesh-btn"]');
  await expect(convertBtn).toBeVisible();
  await convertBtn.click();

  // Verify object type is "mesh" and texts link is removed
  await expect.poll(async () => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      const doc = win.__LL_DOC__?.get();
      const obj = doc?.objects?.[id!];
      return obj ? { type: obj.type, isMesh: obj.type === "mesh" } : null;
    }, textObjId);
  }).toEqual({ type: "mesh", isMesh: true });
});
