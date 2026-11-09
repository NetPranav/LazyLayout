/**
 * Phase 53: Animation grammar - wiring into the new editor
 *
 * Requirements:
 * - In /editor, select a layer
 * - Open the Motion tab
 * - Give it an animation
 * - Set Category Exit: document clip has type "exit" and trigger "unmount"
 * - Reload the page: inspector still shows Exit / On leave
 * - Set "Follow the pointer": check trigger "pointerMove"
 * - Check site export (window.__LL_EXPORT__.build({ target: "html", styling: "css" })) does not throw and contains the layer
 */

import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true;
  });
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

test.describe("Phase 53 · Animation grammar: close schema gaps in editor", () => {
  test("two-way trigger and category binding survives reload and exports cleanly", async ({ page }) => {
    test.setTimeout(120_000);
    await ready(page);

    // 1. Select the button layer on canvas
    const buttonElement = page.locator('[data-testid="stage-element"][data-element-id="button"]');
    await expect(buttonElement).toBeVisible();
    await buttonElement.click();
    await expect(page.locator('[data-testid="selection-box"]')).toBeVisible();

    // 2. Switch to Motion mode
    await page.getByRole("tab", { name: "Motion" }).click();

    // 3. Give it an animation via preset
    const fadeInBtn = page.getByRole("button", { name: "Fade in" });
    await expect(fadeInBtn).toBeVisible({ timeout: 10_000 });
    await fadeInBtn.click();

    // 4. Set Category to Exit
    const categoryCombobox = page.getByRole("combobox", { name: "Category" });
    await expect(categoryCombobox).toBeVisible({ timeout: 5_000 });
    await categoryCombobox.click();

    const exitOption = page.getByRole("option", { name: "Exit" });
    await expect(exitOption).toBeVisible();
    await exitOption.click();

    // Verify UI displays Exit and default trigger "On leave"
    await expect(categoryCombobox).toContainText("Exit");
    const triggerCombobox = page.getByRole("combobox", { name: "Trigger" });
    await expect(triggerCombobox).toContainText("On leave");

    // 5. Verify document clip has type "exit" and trigger "unmount"
    const clipsAfterExit = await page.evaluate(() => {
      const win = window as unknown as {
        __LL_DOC__: {
          get: () => {
            clips: Record<string, { layerId: string; type: string; trigger: string }>;
          };
        };
      };
      return Object.values(win.__LL_DOC__.get().clips);
    });

    const buttonClip = clipsAfterExit.find((c) => c.layerId === "button");
    expect(buttonClip).toBeDefined();
    expect(buttonClip?.type).toBe("exit");
    expect(buttonClip?.trigger).toBe("unmount");

    // 6. Reload the page and verify inspector persistence
    await waitSaved(page);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => new URL(location.href).searchParams.has("projectId"));
    await waitSaved(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();

    // Re-select button layer and open Motion tab
    const buttonAfterReload = page.locator('[data-testid="stage-element"][data-element-id="button"]');
    await expect(buttonAfterReload).toBeVisible();
    await buttonAfterReload.click();
    await page.getByRole("tab", { name: "Motion" }).click();

    const reloadedCategory = page.getByRole("combobox", { name: "Category" });
    const reloadedTrigger = page.getByRole("combobox", { name: "Trigger" });
    await expect(reloadedCategory).toBeVisible();
    await expect(reloadedCategory).toContainText("Exit");
    await expect(reloadedTrigger).toContainText("On leave");

    // 7. Set trigger to "Follow the pointer" (pointerMove)
    await reloadedTrigger.click();
    const followPointerOption = page.getByRole("option", { name: "Follow the pointer" });
    await expect(followPointerOption).toBeVisible();
    await followPointerOption.click();

    await expect(reloadedTrigger).toContainText("Follow the pointer");

    // Verify document clip trigger changed to "pointerMove" while retaining category "exit"
    const clipsAfterTriggerChange = await page.evaluate(() => {
      const win = window as unknown as {
        __LL_DOC__: {
          get: () => {
            clips: Record<string, { layerId: string; type: string; trigger: string }>;
          };
        };
      };
      return Object.values(win.__LL_DOC__.get().clips);
    });

    const buttonClipUpdated = clipsAfterTriggerChange.find((c) => c.layerId === "button");
    expect(buttonClipUpdated?.type).toBe("exit");
    expect(buttonClipUpdated?.trigger).toBe("pointerMove");

    // 8. Site export build does not throw and contains the layer
    const siteExport = await page.evaluate(async () => {
      const win = window as unknown as {
        __LL_EXPORT__: {
          build: (options: { target: string; styling: string }) => Promise<{
            files: Array<{ path: string; text?: string }>;
            warnings: string[];
          }>;
        };
      };
      return await win.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });

    expect(siteExport).toBeDefined();
    expect(siteExport.files.length).toBeGreaterThan(0);
    const indexHtml = siteExport.files.find((f) => f.path === "index.html");
    expect(indexHtml).toBeDefined();
    expect(indexHtml?.text).toBeDefined();
    expect(indexHtml!.text!.toLowerCase()).toMatch(/button|get started/);
  });
});
