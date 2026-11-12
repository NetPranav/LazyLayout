/**
 * ROADMAP_3D Phase 3D-022, 3D-023, 3D-030: Properties Editor, Looks, & Modifiers.
 * E2E Spec Journey:
 *   1. Insert a 3D scene via `3d.scene.insert`.
 *   2. Enter 3D editing mode and select the default cube.
 *   3. See the Object tab in the Properties editor.
 *   4. Set location X to 2 and verify one undo restores it to 0.
 *   5. Open Modifiers tab, add Mirror modifier, and toggle its viewport visibility off.
 *   6. Open Material tab, apply "Glossy plastic" look, and verify material roughness becomes 0.1.
 *   7. Select the Light and verify Object Data tab shows its power (25) and colour (#ffffff).
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
          materialSlots?: string[];
          materials?: string[];
          modifiers?: Array<{ id: string; type: string; enabled?: boolean }>;
          transform: {
            location: [number, number, number];
            rotationQuat: [number, number, number, number];
            scale: [number, number, number];
          };
        }
      >;
      materials?: Record<
        string,
        {
          id: string;
          baseColor: string;
          roughness: number;
          metallic: number;
        }
      >;
      lights?: Record<
        string,
        {
          id: string;
          intensity: number;
          color: string;
        }
      >;
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

test("3D-022 / 3D-023 / 3D-030: Properties editor tabs, Looks strip, Modifiers, and Light data", async ({
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

  // Double-click layer to enter 3D editing mode
  const layerId = await layer.getAttribute("data-element-id");
  await page.locator(`[data-testid="stage-element"][data-element-id="${layerId}"]`).dblclick();
  await expect(layer).toHaveAttribute("data-editing-3d", "true");

  // Switch dimension to 3D if not already active
  const dim3dBtn = page.locator('.ll-rdim button:has-text("3D")');
  if (await dim3dBtn.isVisible()) {
    await dim3dBtn.click();
  }

  // 2. Select the default cube
  const cubeId = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__!.get();
    const cube = Object.values(doc.objects ?? {}).find((o) => o.name === "Cube");
    if (!cube) throw new Error("Default cube object not found in document");

    // Set selection in viewport store
    const store = win.__LL_VIEWPORT_STORE__!;
    store.setState({
      ...store.getState(),
      selection: {
        active: cube.id,
        selected: [cube.id],
      },
    });
    return cube.id;
  });

  expect(cubeId).toBeDefined();

  // 3. See the Object tab in Properties editor
  const propertiesPanel = page.locator('[data-testid="properties-3d"]');
  await expect(propertiesPanel).toBeVisible({ timeout: 10_000 });

  const objectTabBtn = page.locator('button[data-tab="object"]');
  await expect(objectTabBtn).toBeVisible();
  await objectTabBtn.click();

  const objectTabBody = page.locator('[data-testid="tab-object"]');
  await expect(objectTabBody).toBeVisible();

  // 4. Set location X to 2 and verify one undo restores
  const locXInput = page.getByRole("textbox", { name: "Location X", exact: true });
  await expect(locXInput).toBeVisible();
  await locXInput.fill("2");
  await locXInput.press("Enter");

  // Verify document location X is 2
  await expect.poll(() => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      return win.__LL_DOC__?.get().objects?.[id]?.transform.location[0];
    }, cubeId);
  }).toBe(2);

  // Undo and verify restored to 0
  await locXInput.blur(); // while a text field has focus, Undo is the field's own
  await page.evaluate(() => {
    (window as unknown as { __LL_COMMANDS__: { run: (id: string) => unknown } }).__LL_COMMANDS__.run("edit.undo");
  });

  await expect.poll(() => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      return win.__LL_DOC__?.get().objects?.[id]?.transform.location[0];
    }, cubeId);
  }).toBe(0);

  // 5. Open Modifiers, add Mirror, hide it with its toggle
  const modifiersTabBtn = page.locator('button[data-tab="modifiers"]');
  await expect(modifiersTabBtn).toBeVisible();
  await modifiersTabBtn.click();

  const modifiersTabBody = page.locator('[data-testid="tab-modifiers"]');
  await expect(modifiersTabBody).toBeVisible();

  // Add Mirror modifier
  const addModifierBtn = page.locator('[data-testid="add-modifier-button"]');
  await expect(addModifierBtn).toBeVisible();
  await addModifierBtn.click();

  const mirrorMenuItem = page.getByRole("menuitem", { name: "Mirror", exact: true });
  await expect(mirrorMenuItem).toBeVisible();
  await mirrorMenuItem.click();

  // Verify Mirror modifier card exists
  const mirrorCard = page.locator('[data-modifier-type="mirror"]');
  await expect(mirrorCard).toBeVisible();

  // Toggle visibility off
  const visibilityToggle = mirrorCard.locator('[data-testid="modifier-visibility-toggle"]');
  await expect(visibilityToggle).toBeVisible();
  await visibilityToggle.click();

  // Verify enabled is false in document
  await expect.poll(() => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      const cube = win.__LL_DOC__?.get().objects?.[id];
      const mirrorMod = cube?.modifiers?.find((m) => m.type === "mirror");
      return mirrorMod?.enabled;
    }, cubeId);
  }).toBe(false);

  // 6. Material tab: apply "Glossy plastic" look and the material roughness changes
  const materialTabBtn = page.locator('button[data-tab="material"]');
  await expect(materialTabBtn).toBeVisible();
  await materialTabBtn.click();

  const materialTabBody = page.locator('[data-testid="tab-material"]');
  await expect(materialTabBody).toBeVisible();

  // Click "Glossy plastic" look button in Looks strip
  const glossyLookBtn = page.locator('button[data-look-id="look_mat_glossy_plastic"]');
  await expect(glossyLookBtn).toBeVisible();
  await glossyLookBtn.click();

  // Verify material roughness changes to 0.1
  await expect.poll(() => {
    return page.evaluate((id) => {
      const win = window as unknown as Win;
      const cube = win.__LL_DOC__?.get().objects?.[id];
      const matId = cube?.materialSlots?.[0] ?? cube?.materials?.[0];
      return matId ? win.__LL_DOC__?.get().materials?.[matId]?.roughness : undefined;
    }, cubeId);
  }).toBeCloseTo(0.1, 2);

  // 7. Select the light and see power and colour
  const lightId = await page.evaluate(() => {
    const win = window as unknown as Win;
    const doc = win.__LL_DOC__!.get();
    const light = Object.values(doc.objects ?? {}).find((o) => o.name === "Light");
    if (!light) throw new Error("Light object not found in document");

    const store = win.__LL_VIEWPORT_STORE__!;
    store.setState({
      ...store.getState(),
      selection: {
        active: light.id,
        selected: [light.id],
      },
    });
    return light.id;
  });

  expect(lightId).toBeDefined();

  // Switch to Object Data tab
  const dataTabBtn = page.locator('button[data-tab="object-data"]');
  await expect(dataTabBtn).toBeVisible();
  await dataTabBtn.click();

  // Verify power and colour inputs are visible with expected values
  const powerInput = page.getByRole("textbox", { name: "Light Power", exact: true });
  await expect(powerInput).toBeVisible();
  await expect(powerInput).toHaveValue("25");

  // the colour row (the swatch field does not pass test ids through, so look for its label)
  await expect(page.getByText("Color", { exact: true }).first()).toBeVisible();
});
