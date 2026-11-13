/**
 * Phase 36 on the new editor: a file dropped on the canvas becomes an asset and an image layer that draws from the asset
 * store, and is still there after a reload. (The older Phase 36 specs drive the legacy editor.)
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved } from "./support/editor";

const PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.values((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers));
const imageLayers = async (page: Page) => (await layers(page)).filter((l) => l.archetype === "image");

test.use({ viewport: { width: 1600, height: 1000 } });

test("a dropped picture becomes an asset and an image layer, and survives a reload", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const before = (await imageLayers(page)).length;

  await page.evaluate((b64) => {
    const stage = document.querySelector('[data-testid="stage-viewport"]')!;
    const r = stage.getBoundingClientRect();
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], "dot.png", { type: "image/png" }));
    stage.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }));
  }, PNG_B64);

  await expect.poll(async () => (await imageLayers(page)).length).toBe(before + 1);
  const layer = (await imageLayers(page)).at(-1)!;
  expect(String(layer.properties["media.src"])).toMatch(/^asset:/);

  const drawnPicture = () =>
    page.locator(`[data-testid="stage-page"] [data-archetype="image"][data-element-id="${layer.id}"] img`).first()
      .evaluate((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0);
  await expect.poll(drawnPicture, "the picture is drawn from the asset store").toBe(true);

  await waitSaved(page);
  await page.reload();
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await expect.poll(drawnPicture, "after a reload the picture still draws").toBe(true);
});
