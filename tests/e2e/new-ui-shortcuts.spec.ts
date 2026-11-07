/** Select All, Delete and Backspace work wherever the pointer is (not only over the canvas), and never while typing in a field. */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

type Doc = { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null; name: string }> } };
const shapes = (page: Page) => page.evaluate(() => Object.values((window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers).filter((l) => l.archetype === "rectangle").length);

async function threeShapes(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Rectangle/ }).click();
    await page.mouse.move(b.x + b.width * (0.1 + i * 0.2), b.y + b.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * (0.2 + i * 0.2), b.y + b.height * 0.45, { steps: 4 });
    await page.mouse.up();
  }
  expect(await shapes(page)).toBe(3);
}
const selectedRows = (page: Page) => page.locator('#p-layers .row[aria-selected="true"]').count();

for (const where of ["canvas", "inspector", "top bar"] as const) {
  test(`Select All then Backspace and Delete, with the pointer over the ${where}`, async ({ page }) => {
    await threeShapes(page);
    const over = async () => {
      if (where === "canvas") await page.locator("[data-stage=artboard]").hover({ position: { x: 20, y: 20 } });
      else if (where === "inspector") await page.mouse.move(1500, 420); // over the right-hand inspector
      else await page.mouse.move(700, 20);
    };
    await over();
    await page.keyboard.press("ControlOrMeta+a");
    await expect.poll(() => selectedRows(page), "all three are selected").toBe(3);
    await page.keyboard.press("Backspace");
    await expect.poll(() => shapes(page), "Backspace deletes (the Mac delete key)").toBe(0);
    await page.keyboard.press("ControlOrMeta+z");
    await expect.poll(() => shapes(page), "one undo brings them back").toBe(3);
    await over();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await expect.poll(() => shapes(page), "Delete deletes too").toBe(0);
  });
}

test("typing in a field never deletes layers", async ({ page }) => {
  await threeShapes(page);
  await page.locator("#p-layers .row[data-sel]").first().click();
  const name = page.getByLabel("Layer name", { exact: true }).first();
  const field = (await name.count()) ? name : page.getByLabel("X", { exact: true }).first();
  await field.click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await page.keyboard.press("ControlOrMeta+a");
  expect(await shapes(page), "layers untouched while a field has focus").toBe(3);
});
