/**
 * Design track D4: a driver (a binding) makes a layer react to the pointer. The engine runs in Motion and Preview; in Design
 * the canvas shows the design itself.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const drawnBox = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first().boundingBox();

test.describe("Drivers (D4)", () => {
  test("the pointer drives a layer's position in Motion; Design shows the design", async ({ page }) => {
    const r = await setup(page);
    const designX = (await drawnBox(page, r.id))!.x;

    await page.getByText("Motion", { exact: true }).first().click();
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
    await page.evaluate(
      ([id]) => (window as unknown as { __LL_ENGINE__: { addBinding: (t: string, o: string) => string } }).__LL_ENGINE__.addBinding(`pointer.x |> remap(0, 1000, 0, 300)\n-> ${id}.transform.x blend add`, id),
      [r.id],
    );

    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    const at = async (fx: number) => {
      await page.mouse.move(page0.x + page0.width * fx, page0.y + page0.height * 0.8, { steps: 6 });
      await page.waitForTimeout(250);
      return (await drawnBox(page, r.id))!.x;
    };
    const left = await at(0.1);
    const right = await at(0.9);
    expect(right - left, "moving the pointer right moves the layer right").toBeGreaterThan(40);

    // the document itself is unchanged: a driver is behaviour, not a stored position
    expect((await layers(page))[r.id].properties["transform.x"] ?? 0).toBe(r.properties["transform.x"] ?? 0);

    // and Design shows the design again
    await page.getByText("Design", { exact: true }).first().click();
    await expect.poll(async () => Math.abs((await drawnBox(page, r.id))!.x - designX)).toBeLessThan(1.5);
  });
});
