/**
 * Design track D3: the Style code box. Declarations typed for a layer set the matching controls, the rest are drawn and
 * exported as written, and a hostile declaration is refused with a message.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

test.use({ viewport: { width: 1600, height: 1000 } });

async function frameLayer(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await page.getByRole("button", { name: /^Frame/ }).first().click();
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.45, { steps: 4 });
  await page.mouse.move(b.x + b.width * 0.6, b.y + b.height * 0.7, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
const code = (page: Page) => page.getByLabel("Style code", { exact: true });
const exported = (page: Page) =>
  page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const r = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return r.files.map((f) => f.text ?? "").join("\n");
  });

test.describe("Style code", () => {
  test("padding: 24px sets Padding; backdrop-filter is drawn and exported as written", async ({ page }) => {
    const f = await frameLayer(page);
    await code(page).fill("padding: 24px; backdrop-filter: blur(8px)");
    await code(page).blur();

    // the control and the document
    await expect.poll(async () => (await layers(page))[f.id].properties["layout.padding"]).toBe(24);
    expect((await layers(page))[f.id].properties["style.custom"]).toBe("backdrop-filter: blur(8px)");
    // the canvas
    await expect.poll(() => drawn(page, f.id).evaluate((e) => getComputedStyle(e).paddingTop)).toBe("24px");
    await expect.poll(() => drawn(page, f.id).evaluate((e) => getComputedStyle(e).backdropFilter)).toContain("blur(8px)");
    // the export keeps the unknown declaration unchanged
    expect(await exported(page)).toMatch(/backdrop-filter:\s*blur\(8px\)/);
    // and the box shows both again after the layer is reselected
    await expect(code(page)).toHaveValue(/padding: 24px;[\s\S]*backdrop-filter: blur\(8px\);/);
  });

  test("a control change shows up in the code", async ({ page }) => {
    const f = await frameLayer(page);
    await page.getByRole("button", { name: "More Layout options", exact: true }).first().click();
    const pad = page.getByLabel("Padding top", { exact: true }).first();
    await pad.fill("30");
    await pad.press("Enter");
    await expect.poll(async () => String((await layers(page))[f.id].properties["layout.padding"] ?? "")).not.toBe("");
    await expect(code(page)).toHaveValue(/padding: /);
  });

  test("a hostile declaration is refused with a message and nothing is applied", async ({ page }) => {
    const f = await frameLayer(page);
    await code(page).fill("padding: 40px; width: expression(alert(1))");
    await code(page).blur();
    const alert = page.getByRole("alert", { name: "Style code errors" });
    await expect(alert).toContainText("Line 1");
    await expect(alert).toContainText("can run code");
    const props = (await layers(page))[f.id].properties;
    expect(props["layout.padding"]).not.toBe(40); // a typo never half-applies
    expect(props["style.custom"] ?? "").toBe("");
  });

  test("removing a line puts its control back to the default", async ({ page }) => {
    const f = await frameLayer(page);
    await code(page).fill("border-radius: 12px; transition: all 200ms ease");
    await code(page).blur();
    await expect.poll(async () => (await layers(page))[f.id].properties["appearance.radius"]).toBe(12);
    await code(page).fill("transition: all 200ms ease");
    await code(page).blur();
    await expect.poll(async () => (await layers(page))[f.id].properties["appearance.radius"] ?? 0).toBe(0);
    expect((await layers(page))[f.id].properties["style.custom"]).toBe("transition: all 200ms ease");
  });
});
