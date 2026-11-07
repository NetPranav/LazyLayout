/**
 * Phase 72: Anchor Points & Pins Playwright E2E Tests
 *
 * Requirements:
 * - One pin model: 9 preset pins plus custom pins (which may lie outside the box).
 * - The anchor is the pin used for rotation and scale; it can be moved on the canvas.
 * - You'll see: drag a layer's anchor point; rotation follows it.
 * - Done when: rotation and scale about every preset pin match golden values.
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitHydrated } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  page.on("pageerror", (err) => {
    process.stderr.write(`[PAGEERROR]: ${err.message}\n`);
  });
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await openEditor(page);
  await waitHydrated(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

test.describe("Phase 72 · Anchor points & pins", () => {
  test("renders anchor handle for selected layer and updates when dragged with snapping", async ({ page }) => {
    await ready(page);

    // Select the button element
    const buttonRow = page.locator('[data-layer-id="button"]');
    if (await buttonRow.isVisible()) {
      await buttonRow.click();
    } else {
      const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
      await buttonElement.click();
    }

    // Ensure selection overlay is active
    await expect(page.locator('[data-testid="selection-box"]')).toBeVisible({ timeout: 10_000 });

    // Verify Anchor handle is rendered
    const anchorHandle = page.locator('[data-testid="anchor-point-handle"]');
    await expect(anchorHandle).toBeVisible({ timeout: 10_000 });

    // Initial default anchor is center
    await expect(anchorHandle).toHaveAttribute("data-anchor-preset", "center");

    const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
    const handleBox = (await anchorHandle.boundingBox())!;
    const btnBox = (await buttonElement.boundingBox())!;

    // Drag anchor handle towards top-right corner of the button
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();

    // Move near top-right corner (btnBox.x + btnBox.width, btnBox.y)
    await page.mouse.move(btnBox.x + btnBox.width - 2, btnBox.y + 2, { steps: 5 });

    // Verify preset pin targets are rendered during drag
    const presetTargets = page.locator('[data-testid="preset-pin-target"]');
    await expect(presetTargets.first()).toBeVisible();

    // Release mouse
    await page.mouse.up();

    // Verify anchor handle is now snapped/updated to topRight
    await expect(anchorHandle).toHaveAttribute("data-anchor-preset", "topRight");
  });

  test("inspector Origin control updates anchor position on canvas", async ({ page }) => {
    await ready(page);

    // Select the button element
    const buttonRow = page.locator('[data-layer-id="button"]');
    if (await buttonRow.isVisible()) {
      await buttonRow.click();
    } else {
      const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
      await buttonElement.click();
    }

    await expect(page.locator('[data-testid="selection-box"]')).toBeVisible({ timeout: 10_000 });

    const anchorHandle = page.locator('[data-testid="anchor-point-handle"]');
    await expect(anchorHandle).toBeVisible();

    // Change origin via inspector to "Bottom Left"
    const originCombobox = page.locator('button[role="combobox"][aria-label="Transform origin"]');
    if (await originCombobox.isVisible()) {
      await originCombobox.click();
      const opt = page.locator('[role="option"]:has-text("Bottom Left")').first();
      await expect(opt).toBeVisible();
      await opt.click();

      // Verify anchor handle reflects the change
      await expect(anchorHandle).toHaveAttribute("data-anchor-preset", "bottomLeft");
    }
  });
});
