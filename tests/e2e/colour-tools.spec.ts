/**
 * ROADMAP Phase 123: colour tools in the inspector. Pick a photo and get a matching palette saved as colour tokens; a
 * text on a dark card shows its contrast and "Fix contrast" makes it pass; a shape's colour gives a harmony and a
 * tint-and-shade scale as tokens.
 */
import { test, expect, type Page } from "@playwright/test";
import { PNG } from "pngjs";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; name?: string; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L>; variables?: Record<string, { name: string; type: string; values: Record<string, string> }> }; commands: { addLayer: (o: unknown) => string } };

test.use({ viewport: { width: 1600, height: 1000 } });

async function add(page: Page, archetype: string, props: Record<string, unknown>, parent?: string, name?: string) {
  return page.evaluate(({ archetype, props, parent, name }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = parent ?? Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!.id;
    return doc.commands.addLayer({ archetype, parentId: frame, ...(name ? { name } : {}), properties: { positioning: "absolute", ...props } });
  }, { archetype, props, parent, name });
}
const select = (page: Page, id: string) => page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), id);
const tokens = (page: Page) => page.evaluate(() => Object.values((window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().variables ?? {}).map((v) => ({ name: v.name, value: Object.values(v.values)[0] })));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
});

test("a photo's palette is saved as colour tokens", async ({ page }) => {
  // a photo of three colour fields: blue (60%), yellow and red (20% each)
  const p = new PNG({ width: 60, height: 40 });
  for (let y = 0; y < 40; y++)
    for (let x = 0; x < 60; x++) p.data.set(x < 36 ? [20, 60, 200, 255] : y < 20 ? [240, 200, 40, 255] : [200, 30, 60, 255], (y * 60 + x) * 4);
  const src = `data:image/png;base64,${PNG.sync.write(p).toString("base64")}`;
  const id = await add(page, "image", { "frame.x": 40, "frame.y": 40, "frame.width": 240, "frame.height": 160, "media.src": src }, undefined, "Beach");
  await select(page, id);
  await page.getByRole("button", { name: "Palette from picture" }).click();
  await expect(page.getByRole("list", { name: "Picture palette" }).getByRole("listitem")).toHaveCount(3);
  await expect.poll(async () => (await tokens(page)).filter((t) => t.name.startsWith("Beach palette/")).length).toBe(3);
  const saved = (await tokens(page)).filter((t) => t.name.startsWith("Beach palette/"));
  expect(saved.find((t) => t.name === "Beach palette/1")!.value).toBe("#143CC8");
  expect(saved.map((t) => t.value).sort()).toEqual(["#143CC8", "#C81E3C", "#F0C828"]);
});

test("a low-contrast text shows it and is fixed to the nearest colour that passes", async ({ page }) => {
  const card = await add(page, "container", { "frame.x": 40, "frame.y": 40, "frame.width": 300, "frame.height": 120, "appearance.background.color": "#1e293b" });
  const text = await add(page, "text", { "frame.x": 20, "frame.y": 20, "content.text": "Read me", "typography.color": "#475569", "typography.fontSize": 20 }, card);
  await select(page, text);
  const report = page.locator("[data-contrast-report]");
  await expect(report).toContainText("fail");
  await page.getByRole("button", { name: "Fix contrast" }).click();
  await expect(report).toContainText(/AA/);
  await expect(page.getByRole("button", { name: "Passes" })).toBeVisible();
  // AAA asks for more: fixed again, still lighter on the dark card
  await page.getByRole("combobox", { name: "Contrast target" }).click();
  await page.getByRole("option", { name: "WCAG AAA (7:1)" }).click();
  await page.getByRole("button", { name: "Fix contrast" }).click();
  await expect(report).toContainText("AAA");
});

test("a shape's colour gives a harmony and tints and shades as tokens", async ({ page }) => {
  const id = await add(page, "rectangle", { "frame.x": 40, "frame.y": 40, "frame.width": 120, "frame.height": 80, "svg.fill": "#2f6bff" }, undefined, "Brand");
  await select(page, id);
  await page.getByRole("combobox", { name: "Harmony rule" }).click();
  await page.getByRole("option", { name: "Triad" }).click();
  await page.getByRole("button", { name: "Save harmony" }).click();
  await page.getByRole("button", { name: "Save tints & shades" }).click();
  await expect.poll(async () => (await tokens(page)).map((t) => t.name).filter((n) => n.startsWith("Brand")).sort()).toEqual(
    ["Brand triad/2", "Brand triad/3", "Brand triad/base", ...[50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((s) => `Brand/${s}`)].sort(),
  );
  expect((await tokens(page)).find((t) => t.name === "Brand triad/base")!.value).toBe("#2F6BFF");
});
