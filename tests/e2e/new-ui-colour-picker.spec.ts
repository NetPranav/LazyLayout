/** Every colour square in the inspector opens the colour picker: the page background, the theme colours and the ones on special layers. */
import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

test("the page background and theme swatches open the colour picker and apply what is picked", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await page.locator("body").click({ position: { x: 700, y: 140 } }); // nothing selected: the page's own inspector

  const swatch = page.getByRole("button", { name: "Page background colour picker" });
  await expect(swatch).toBeVisible();
  await swatch.click();
  const picker = page.locator("[data-color-picker]");
  await expect(picker, "a picker opens").toBeVisible();
  await picker.getByRole("textbox").first().fill("FF3300");
  await picker.getByRole("textbox").first().press("Enter");
  await expect(page.getByLabel("Background hex", { exact: true })).toHaveValue("FF3300");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => {
    const d = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, { parentId: string | null; properties: Record<string, unknown> }> } } }).__LL_DOC__.get();
    const root = Object.values(d.layers).find((l) => l.parentId === null)!;
    return String(root.properties["appearance.background.color"]).toUpperCase();
  }), "the page's background changed").toBe("#FF3300");

  // the theme colours have pickers too
  const primary = page.getByRole("button", { name: "Primary colour picker" });
  await primary.click();
  await expect(page.locator("[data-color-picker]")).toBeVisible();
  await page.locator("[data-color-picker]").getByRole("textbox").first().fill("00AA55");
  await page.locator("[data-color-picker]").getByRole("textbox").first().press("Enter");
  await expect(page.getByLabel("Primary hex", { exact: true })).toHaveValue("00AA55");
});
