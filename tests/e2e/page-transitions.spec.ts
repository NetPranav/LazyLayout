/**
 * ROADMAP Phase 89: the Page transition section. On a page (a frame) it sets how Preview enters it; on a layer inside
 * a page it names a shared element. The motion itself is sampled in the unit tests (the native and the fallback path
 * share one recipe); here the controls and the document are checked.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; parentId: string | null; properties: Record<string, unknown> };
type Win = {
  __LL_TEST__: boolean;
  __LL_SELECT__: (id: string) => void;
  __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (l: unknown) => string } };
};
test.use({ viewport: { width: 1600, height: 1000 } });
const prop = (page: Page, id: string, key: string) => page.evaluate(({ id, key }) => (window as unknown as Win).__LL_DOC__.get().layers[id].properties[key], { id, key });

test("Phase 89: a page says how it is entered, and a layer can be shared between pages", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.waitForFunction(() => !!(window as unknown as Win).__LL_DOC__);
  const { frame, child } = await page.evaluate(() => {
    const w = window as unknown as Win;
    const frame = Object.values(w.__LL_DOC__.get().layers).find((l) => l.parentId === null)!.id;
    const child = w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name: "Hero image", properties: { positioning: "absolute", "frame.x": 20, "frame.y": 40, "frame.width": 80, "frame.height": 60 } });
    return { frame, child };
  });

  // the page
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), frame);
  const section = page.locator('[data-section="page-transition"]');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByLabel("How this page is entered")).toBeVisible();
  await expect(section.getByLabel("Page transition time")).toHaveCount(0);
  await section.getByLabel("How this page is entered").click();
  await page.getByRole("option", { name: "Push" }).click();
  await expect.poll(() => prop(page, frame, "pageTransition.type")).toBe("push");
  await expect(section.getByLabel("Page transition time")).toBeVisible();
  const time = section.getByLabel("Page transition time");
  await time.fill("0.8");
  await time.press("Enter");
  await expect.poll(() => prop(page, frame, "pageTransition.duration")).toBe(0.8);

  // a layer in it
  await page.evaluate((i) => (window as unknown as Win).__LL_SELECT__(i), child);
  const shared = page.locator('[data-section="page-transition"]').getByLabel("Shared element name");
  await shared.scrollIntoViewIfNeeded();
  await expect(page.getByLabel("Shared element partners")).toContainText("Give a layer on two pages the same name");
  await shared.fill("hero-image");
  await shared.press("Enter");
  await expect.poll(() => prop(page, child, "sharedElement.id")).toBe("hero-image");
  await expect(page.getByLabel("Shared element partners")).toContainText("No other page has a layer with this name yet");
});
