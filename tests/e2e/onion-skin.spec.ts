/**
 * Phase 71: Onion skin Playwright E2E Tests
 *
 * Requirements:
 * - N ghost frames before and after the playhead at adjustable opacity, drawn from evaluate().
 * - Done when: 5 ghosts hold 60 fps.
 * - Transport toggle button enables/disables onion skin.
 * - Ghost frames appear behind live element and have pointer-events: none.
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  page.on("pageerror", (err) => {
    process.stderr.write(`[PAGEERROR]: ${err.message}\n`);
  });
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

test.describe("Phase 71 · Onion skin", () => {
  test("timeline onion skin button toggles onion skin state in transport", async ({ page }) => {
    await ready(page);

    // Switch to Motion mode to reveal timeline panel
    await page.getByRole("tab", { name: "Motion" }).click();

    // Check timeline onion skin button
    const onionBtn = page.locator('[data-testid="timeline-onion-skin-button"]');
    await expect(onionBtn).toBeVisible({ timeout: 10_000 });
    await expect(onionBtn).toHaveAttribute("aria-pressed", "false");

    // Toggle onion skin ON
    await onionBtn.click();
    await expect(onionBtn).toHaveAttribute("aria-pressed", "true");

    // Toggle onion skin OFF
    await onionBtn.click();
    await expect(onionBtn).toHaveAttribute("aria-pressed", "false");
  });

  test("onion skin renders ghost frames on stage without blocking canvas interactions", async ({ page }) => {
    await ready(page);

    // Select the button element on stage
    const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
    await expect(buttonElement).toBeVisible();
    await buttonElement.click();

    // Switch to Motion mode
    await page.getByRole("tab", { name: "Motion" }).click();

    // 1. Record keyframes at two playhead times so the layer has motion
    const recordBtn = page.locator('[data-testid="timeline-record-button"]');
    await expect(recordBtn).toBeVisible();
    await recordBtn.click();
    await expect(recordBtn).toHaveAttribute("aria-pressed", "true");

    const ruler = page.locator('[data-testid="timeline-ruler"]');
    await expect(ruler).toBeVisible();
    const rulerBox = (await ruler.boundingBox())!;

    // Drag 1 at t=0
    await page.mouse.click(rulerBox.x + 30, rulerBox.y + 10);
    let box = (await buttonElement.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2, { steps: 2 });
    await page.mouse.up();

    // Drag 2 at t=2
    await page.mouse.click(rulerBox.x + 180, rulerBox.y + 10);
    box = (await buttonElement.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, { steps: 2 });
    await page.mouse.up();

    // Disable record mode
    await recordBtn.click();

    // 2. Enable Onion Skin
    const onionBtn = page.locator('[data-testid="timeline-onion-skin-button"]');
    await onionBtn.click();
    await expect(onionBtn).toHaveAttribute("aria-pressed", "true");

    // Position playhead in between (e.g. t = 1) so both past and future ghosts exist
    await page.mouse.click(rulerBox.x + 100, rulerBox.y + 10);

    // 3. Verify Onion Skin overlay and ghosts are rendered on stage
    const overlay = page.locator('[data-testid="onion-skin-overlay"]');
    await expect(overlay).toBeVisible();

    const ghosts = page.locator('[data-testid="onion-ghost"]');
    const ghostCount = await ghosts.count();
    expect(ghostCount).toBeGreaterThan(0);

    // Verify pointer-events: none on overlay and ghosts to ensure no interaction blocking
    await expect(overlay).toHaveCSS("pointer-events", "none");
    await expect(ghosts.first()).toHaveCSS("pointer-events", "none");

    // 4. Verify layer on stage is still directly clickable through the onion skin
    await buttonElement.click();
    await expect(buttonElement).toBeVisible();

    // 5. Toggle Onion Skin OFF and confirm overlay disappears
    await onionBtn.click();
    await expect(onionBtn).toHaveAttribute("aria-pressed", "false");
    await expect(overlay).toBeHidden();
  });
});
