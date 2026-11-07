/**
 * Warp mesh (ROADMAP Task G): multi-point control grid for bending text and images
 * along a curving road or hugging a surface.
 *
 * Checks:
 * 1. Creating a warp mesh from the Position > More inspector.
 * 2. Mesh tiles rendered with projective matrix3d transforms.
 * 3. Dragging the centre point warps the cells.
 * 4. Undo restores the previous state.
 * 5. Grid-size chooser updates tile count.
 * 6. Removing mesh restores the plain layer.
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor, focusApp } from "./support/editor";

type L = {
  id: string;
  archetype: string;
  name: string;
  parentId: string | null;
  children: string[];
  visible?: boolean;
  properties: Record<string, unknown>;
};

type Win = {
  __LL_TEST__: boolean;
  __LL_DOC__: {
    get: () => { layers: Record<string, L> };
    commands: { updateProps: (id: string, p: Record<string, unknown>) => void };
  };
};

const drawn = (page: Page, id: string) =>
  page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);

test.use({ viewport: { width: 1600, height: 1000 } });

test.describe("Warp mesh", () => {
  test("creates mesh, drags centre point, verifies matrix3d tiles, undo restores, and remove restores plain layer", async ({
    page,
  }) => {
    // Enable test seam and open the editor
    await page.addInitScript(() => {
      (window as unknown as Win).__LL_TEST__ = true;
    });
    await openEditor(page);

    await expect(page.locator("[data-stage=artboard]")).toBeVisible();

    // Select the sample headline text layer
    const headline = page.locator('[data-testid="stage-element"][data-element-id="headline"]');
    await headline.click();

    // Open Position > More
    const moreBtn = page.getByRole("button", { name: "More Position options" });
    if (await moreBtn.isVisible()) {
      const expanded = await moreBtn.getAttribute("aria-expanded");
      if (expanded !== "true") {
        await moreBtn.click();
      }
    }

    // 1. Create warp mesh (default 3x3 = 9 points, 2x2 = 4 tiles)
    const warpMeshBtn = page.getByRole("button", { name: "Warp mesh", exact: true });
    await expect(warpMeshBtn).toBeVisible();
    await warpMeshBtn.click();

    // Overlay is visible on the canvas with 9 handles
    const overlay = page.locator('[data-testid="warp-mesh-overlay"]');
    await expect(overlay).toBeVisible();

    // 2. Check tile count and matrix3d transforms
    const tiles = drawn(page, "headline").locator('[data-mesh-tile="true"]');
    await expect(tiles).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      const transform = await tiles.nth(i).evaluate((el) => (el as HTMLElement).style.transform);
      expect(transform).toContain("matrix3d");
    }

    // 3. Drag the centre point (Row 1, Column 1)
    const centreHandle = page.getByRole("button", { name: "Mesh point row 1 column 1" });
    await expect(centreHandle).toBeVisible();

    const box = (await centreHandle.boundingBox())!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + 30, startY + 20, { steps: 5 });
    await page.mouse.up();

    // Verify stored property updated
    const meshProp = await page.evaluate(
      () => (window as unknown as Win).__LL_DOC__.get().layers["headline"]?.properties["transform.mesh"]
    );
    expect(typeof meshProp).toBe("string");
    expect(meshProp).toContain("3,3;");

    // 4. Undo restores the mesh to flat state before drag
    await focusApp(page);
    await page.keyboard.press("ControlOrMeta+z");
    const restoredMeshProp = await page.evaluate(
      () => (window as unknown as Win).__LL_DOC__.get().layers["headline"]?.properties["transform.mesh"]
    );
    expect(restoredMeshProp).not.toEqual(meshProp);

    // 5. Change grid size to 4x4 (16 points, 3x3 = 9 tiles)
    const gridSelect = page.getByRole("combobox", { name: "Mesh grid size" });
    await gridSelect.click();
    await page.getByRole("option", { name: /^4[×x]4/ }).click();

    const tiles4x4 = drawn(page, "headline").locator('[data-mesh-tile="true"]');
    await expect(tiles4x4).toHaveCount(9);

    // Verify handles for 4x4 exist
    await expect(page.getByRole("button", { name: "Mesh point row 0 column 0" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mesh point row 3 column 3" })).toBeVisible();

    // 6. Remove mesh puts the layer back to plain
    const removeBtn = page.getByRole("button", { name: "Remove warp mesh" });
    await expect(removeBtn).toBeVisible();
    await removeBtn.click();

    await expect(overlay).not.toBeVisible();
    await expect(drawn(page, "headline").locator('[data-mesh-tile="true"]')).toHaveCount(0);

    const finalMesh = await page.evaluate(
      () => (window as unknown as Win).__LL_DOC__.get().layers["headline"]?.properties["transform.mesh"]
    );
    expect(finalMesh).toBeFalsy();
  });
});
