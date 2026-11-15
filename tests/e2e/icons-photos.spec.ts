/**
 * ROADMAP Phase 126: icons, illustrations and stock media. Search "arrow", drop an icon in and recolour it like any
 * shape; search photos (Openverse, answered here by a recorded reply) and insert one. Every inserted icon and photo is
 * in the asset store with its licence and source, and its layers point at it.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; name?: string; properties: Record<string, unknown> };
type Asset = { id: string; kind: string; name: string; source?: Record<string, string> };
type Doc = { get: () => { layers: Record<string, L>; assets?: Record<string, Asset> } };

test.use({ viewport: { width: 1600, height: 1000 } });

const doc = (page: Page) => page.evaluate(() => {
  const d = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get();
  return { layers: d.layers, assets: d.assets ?? {} };
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test('search "arrow", drop an icon in and recolour it; its asset has its licence and source', async ({ page }) => {
  await page.getByRole("button", { name: "Image", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Icons and photos" });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search icons").fill("arrow");
  const tile = dialog.getByRole("button", { name: "Insert icon Arrow right", exact: true });
  await expect(tile).toBeEnabled();
  const before = Object.keys((await doc(page)).layers);
  await tile.click();
  await expect(dialog.getByRole("status")).toHaveText("Inserted Arrow right");

  const d = await doc(page);
  const added = Object.values(d.layers).filter((l) => !before.includes(l.id) && l.properties["asset.source"]);
  expect(added.length).toBeGreaterThan(0);
  const asset = d.assets[String(added[0].properties["asset.source"])];
  expect(asset.kind).toBe("svg");
  expect(asset.source).toEqual({ kind: "icon", provider: "Lucide", id: "arrow-right", title: "Arrow right", url: "https://lucide.dev/icons/arrow-right", licence: "ISC and MIT (Feather)", licenceUrl: "https://lucide.dev/license" });

  // recolour it like any shape: its stroke in the inspector
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  const path = added.find((l) => l.archetype === "svgPath") ?? added[0];
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), path.id);
  const hex = page.getByLabel("Stroke hex").first();
  await hex.fill("E11D48");
  await hex.press("Enter");
  await expect.poll(async () => JSON.stringify((await doc(page)).layers[path.id].properties).toLowerCase()).toContain("e11d48");
  const drawn = page.locator(`[data-stage=artboard] [data-element-id="${path.id}"] [stroke]`).first();
  await expect.poll(async () => (await drawn.getAttribute("stroke"))?.toLowerCase() ?? "").toMatch(/e11d48|url\(/);
});

test("search photos and insert one: the picture, its licence, author and credit line in the asset store", async ({ page }) => {
  // the provider, answered by a recorded reply (no network in tests)
  const pic = new PNG({ width: 40, height: 30 });
  pic.data.fill(200);
  const png = PNG.sync.write(pic);
  await page.route("https://api.openverse.org/v1/images/?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({ results: [{ id: "p-1", title: "Harbour at dawn", url: "https://img.example/p-1.png", thumbnail: "https://img.example/p-1-thumb.png", creator: "Ana", creator_url: "https://example.org/ana", license: "by", license_version: "4.0", license_url: "https://creativecommons.org/licenses/by/4.0/", foreign_landing_url: "https://example.org/p-1", attribution: '"Harbour at dawn" by Ana is licensed under CC BY 4.0.', width: 40, height: 30 }] }),
    }),
  );
  await page.route("https://img.example/**", (route) => route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: png }));

  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "insert.media")!.run({ tab: "photos" }));
  const dialog = page.getByRole("dialog", { name: "Icons and photos" });
  await dialog.getByLabel("Search photos").fill("harbour");
  await dialog.getByRole("button", { name: "Search" }).click();
  await expect(dialog.getByRole("list", { name: "Photos" }).getByText("Ana · CC BY 4.0")).toBeVisible();
  const before = Object.keys((await doc(page)).layers);
  await dialog.getByRole("button", { name: "Insert photo Harbour at dawn" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Inserted Harbour at dawn");

  const d = await doc(page);
  const image = Object.values(d.layers).find((l) => !before.includes(l.id) && l.archetype === "image")!;
  expect(image.properties["media.alt"]).toBe("Harbour at dawn");
  const asset = d.assets[String(image.properties["asset.source"])];
  expect(String(image.properties["media.src"])).toBe(`asset:${asset.id}`);
  expect(asset.kind).toBe("image");
  expect(asset.source).toEqual({ kind: "photo", provider: "Openverse", id: "p-1", title: "Harbour at dawn", url: "https://example.org/p-1", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", author: "Ana", authorUrl: "https://example.org/ana", attribution: '"Harbour at dawn" by Ana is licensed under CC BY 4.0.' });
  // every inserted icon and photo has its licence and source
  for (const a of Object.values(d.assets).filter((a) => Object.values(d.layers).some((l) => l.properties["asset.source"] === a.id))) expect(a.source?.licence).toBeTruthy();
});
