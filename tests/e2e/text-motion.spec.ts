/** Design track D12: text motion from the Text motion section, drawn on the canvas, read once by a screen reader. */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });
const select = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(i), id);
const node = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first();
const num = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};

test.describe("Text motion (D12)", () => {
  test("typewriter and count-up show their text at a progress; the full text is read once", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    await select(page, "headline");
    await expect(page.getByTestId("text-motion-section")).toBeVisible();
    await chooseOption(page, "Text effect", "Typewriter");
    await num(page, "Text effect progress", 0.5);
    const text = "Design it once. Ship it lazily.";
    await expect(node(page, "headline").locator("[data-fx]")).toHaveText(text.slice(0, Math.floor(0.5 * text.length)));
    await expect(node(page, "headline")).toMatchAriaSnapshot(`- text: ${text}`);

    await page.evaluate(() => (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: Record<string, unknown>) => void } } }).__LL_DOC__.commands.updateProps("headline", { "content.text": "1,200 users" }));
    await chooseOption(page, "Text effect", "Count up");
    await num(page, "Text effect progress", 0.25);
    await expect(node(page, "headline").locator("[data-fx]")).toHaveText("300 users");
  });

  test("a font axis value is drawn as font-variation-settings", async ({ page }) => {
    await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(page);
    await select(page, "headline");
    await page.getByLabel("Variable font axis", { exact: true }).fill("wght");
    await page.getByLabel("Variable font axis", { exact: true }).press("Tab");
    await num(page, "Variable font axis value", 720);
    await expect.poll(() => node(page, "headline").evaluate((e) => getComputedStyle(e).fontVariationSettings)).toContain("720");
  });
});
