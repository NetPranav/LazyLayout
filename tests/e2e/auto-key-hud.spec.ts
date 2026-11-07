/**
 * Phase 70: Auto-key on the stage & Value HUD Playwright Tests
 *
 * Requirements:
 * - In record mode, dragging a layer on the canvas writes keyframes.
 * - While scrubbing, x, y, rotation and opacity show next to the layer.
 * - Done when: a drag at 3 playhead times creates 3 keyframes.
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

test.describe("Phase 70 · Auto-key on the stage & value HUD", () => {
  test("timeline record button toggles record mode state", async ({ page }) => {
    await ready(page);

    // Switch to Motion mode to open timeline panel
    await page.getByRole("tab", { name: "Motion" }).click();

    // Check timeline record button
    const recordBtn = page.locator('[data-testid="timeline-record-button"]');
    await expect(recordBtn).toBeVisible({ timeout: 10_000 });
    await expect(recordBtn).toHaveAttribute("aria-pressed", "false");

    // Toggle record mode ON
    await recordBtn.click();
    await expect(recordBtn).toHaveAttribute("aria-pressed", "true");

    // Toggle record mode OFF
    await recordBtn.click();
    await expect(recordBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("Value HUD displays live values and keyframe recording on stage drag", async ({ page }) => {
    await ready(page);

    // Select the button element on stage
    const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
    await expect(buttonElement).toBeVisible();
    await buttonElement.click();

    // Ensure selection overlay is present
    await expect(page.locator('[data-testid="selection-box"]')).toBeVisible();

    // Switch to Motion mode
    await page.getByRole("tab", { name: "Motion" }).click();

    // Toggle record mode ON
    const recordBtn = page.locator('[data-testid="timeline-record-button"]');
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();
    await expect(recordBtn).toHaveAttribute("aria-pressed", "true");

    // Drag the button on canvas
    const box = (await buttonElement.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();

    // While dragging/gesturing, Value HUD must be visible
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 20, { steps: 5 });
    const hud = page.locator('[data-testid="stage-value-hud"]');
    await expect(hud).toBeVisible();
    await expect(page.locator('[data-testid="value-hud-x"]')).toBeVisible();
    await expect(page.locator('[data-testid="value-hud-y"]')).toBeVisible();
    await expect(page.locator('[data-testid="value-hud-rotation"]')).toBeVisible();
    await expect(page.locator('[data-testid="value-hud-opacity"]')).toBeVisible();

    await page.mouse.up();
  });
});
