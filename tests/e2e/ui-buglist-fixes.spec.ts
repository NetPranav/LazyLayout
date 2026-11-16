import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1280, height: 800 } });

test.describe("UI Buglist Fixes", () => {
  test("1. Layer context menu shows Rename and inline rename commits cleanly", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(page);

    const row = page.locator('[data-testid="layer-row"][data-layer-id="button"]');
    await row.click({ button: "right" });

    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await expect(page.locator("[data-submenu]").getByRole("menuitem", { name: /^Rename/ })).toHaveCount(0);

    const renameItem = page.getByRole("menuitem", { name: /^Rename/ });
    await expect(renameItem).toHaveCount(1);
    await expect(renameItem).toBeVisible();
    await renameItem.click();

    const renameInput = page.getByRole("textbox", { name: "Rename layer" });
    await expect(renameInput).toBeVisible();
    await expect(renameInput).toBeFocused();
    await renameInput.fill("Primary CTA");
    await renameInput.press("Enter");

    await expect(row).toContainText("Primary CTA");
  });

  test("2. Clip content toggle shows clear ON/OFF and active pressed feedback", async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-testid="layer-row"][data-layer-id="button"]').click();
    const clipBtn = page.getByRole("button", { name: "Clip content" });
    await expect(clipBtn).toBeVisible();
    await expect(clipBtn).toHaveAttribute("aria-pressed", "false");
    await expect(clipBtn).toContainText("Off");

    await clipBtn.click();
    await expect(clipBtn).toHaveAttribute("aria-pressed", "true");
    await expect(clipBtn).toContainText("On");
  });

  test("3. Arrow keys move selected canvas elements along exact axes without leaking from Layers tree", async ({ page }) => {
    await openEditor(page);

    const row = page.locator('[data-testid="layer-row"][data-layer-id="button"]');
    await row.click();
    const xInput = page.getByLabel("X", { exact: true });
    const yInput = page.getByLabel("Y", { exact: true });
    const initialX = await xInput.inputValue();
    const initialY = await yInput.inputValue();

    // Pressing ArrowUp in Layers tree must not nudge the stage element
    await row.focus();
    await page.keyboard.press("ArrowUp");
    await row.click();
    await expect(xInput).toHaveValue(initialX);
    await expect(yInput).toHaveValue(initialY);

    // Click element on canvas and nudge in all 4 directions
    const canvasBtn = page.locator('[data-element-id="button"]').first();
    const box = await canvasBtn.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

    const numX = Number(initialX);
    const numY = Number(initialY);

    await page.keyboard.press("ArrowUp");
    await expect(xInput).toHaveValue(String(numX));
    await expect(yInput).toHaveValue(String(numY - 1));

    await page.keyboard.press("ArrowRight");
    await expect(xInput).toHaveValue(String(numX + 1));
    await expect(yInput).toHaveValue(String(numY - 1));

    await page.keyboard.press("ArrowDown");
    await expect(xInput).toHaveValue(String(numX + 1));
    await expect(yInput).toHaveValue(String(numY));

    await page.keyboard.press("ArrowLeft");
    await expect(xInput).toHaveValue(String(numX));
    await expect(yInput).toHaveValue(String(numY));
  });

  test("4. Insert (+) panel supports browsing and searching icons by name", async ({ page }) => {
    await openEditor(page);

    await page.getByRole("button", { name: /Insert/ }).first().click();
    const dialog = page.getByRole("dialog", { name: "Insert" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('nav button[data-cat="Icons"]')).toBeVisible();

    const search = dialog.getByRole("textbox");
    await search.fill("rocket");

    const rocketCard = dialog.locator('[data-icon-name="rocket"]');
    await expect(rocketCard).toBeVisible();
    await expect(rocketCard).toBeEnabled();
    await rocketCard.click();

    await expect(dialog).toBeHidden();
    await expect(page.locator('[data-testid="layer-row"]').first()).toContainText("Path");
  });

  test("5 & 6. Stroke options Apply button fits inside popover and Right panel has no horizontal scroll", async ({ page }) => {
    await openEditor(page);

    // Unselected state (Page + Theme & Tokens)
    await page.mouse.click(450, 100);
    await expect.poll(() =>
      page.evaluate(() => {
        const zb = document.querySelector(".ll-shell-right .ll-zbody");
        return zb ? zb.scrollWidth <= zb.clientWidth : false;
      })
    ).toBe(true);

    // Draw a rectangle to inspect Stroke options (with WidthProfileOptions Nib/Apply) + States section
    await page.mouse.click(500, 100);
    await page.keyboard.press("r");
    await page.mouse.move(400, 300);
    await page.mouse.down();
    await page.mouse.move(500, 380);
    await page.mouse.up();

    // Verify right panel has no horizontal overflow with rectangle selected
    await expect.poll(() =>
      page.evaluate(() => {
        const zb = document.querySelector(".ll-shell-right .ll-zbody");
        return zb ? zb.scrollWidth <= zb.clientWidth : false;
      })
    ).toBe(true);

    // Add Stroke and open Stroke 1 settings popover
    const addStroke = page.locator('div:has(> h3:text-is("Stroke")) button').last();
    await addStroke.scrollIntoViewIfNeeded();
    await addStroke.click();
    await page.getByRole("button", { name: "Stroke 1 settings" }).click();

    const applyBtn = page.getByRole("button", { name: "Make calligraphic" });
    await expect(applyBtn).toBeVisible();

    const popoverMetrics = await page.evaluate(() => {
      const pop = document.querySelector(".ll-ppop");
      const pbody = pop?.querySelector(".ll-pbody");
      const apply = pop?.querySelector('[aria-label="Make calligraphic"]');
      if (!pop || !pbody || !apply) return null;
      const pr = pop.getBoundingClientRect();
      const ar = apply.getBoundingClientRect();
      return {
        fitsInPopover: ar.right <= pr.right + 1,
        noHorizOverflow: pbody.scrollWidth <= pbody.clientWidth,
      };
    });
    expect(popoverMetrics).toEqual({ fitsInPopover: true, noHorizOverflow: true });
  });
});
