/**
 * ROADMAP Phase 116: a frame used as a live fill in two shapes. An edit to the frame shows in both fills by the next
 * frame the browser draws; clicking a fill still selects its own shape; the export draws the fills too.
 */
import { test, expect } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; updateProps: (id: string, p: unknown) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

test("an edit to the source updates every live fill within one frame; the export draws them", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const ids = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const badge = doc.commands.addLayer({ archetype: "container", parentId: frame.id, name: "Badge", properties: { positioning: "absolute", "frame.x": 400, "frame.y": 20, "frame.width": 100, "frame.height": 50, "appearance.background": "#ffcc00" } });
    const word = doc.commands.addLayer({ archetype: "text", parentId: badge, properties: { "content.text": "SALE" } });
    const fills = JSON.stringify([{ type: "live", source: badge }]);
    const a = doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 20, "frame.y": 20, "frame.width": 160, "frame.height": 80, "paint.fills": fills } });
    const b = doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 200, "frame.y": 20, "frame.width": 120, "frame.height": 80, "paint.fills": fills } });
    return { badge, word, a, b };
  });
  const fill = (id: string) => page.locator(`[data-element-id="${id}"] [data-live-fill]`).first();
  await expect(fill(ids.a)).toContainText("SALE");
  await expect(fill(ids.b)).toContainText("SALE");

  // the edit and the check in one go: after the next frame the browser draws, both fills say the new word
  const seen = await page.evaluate(async ({ word, a, b }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    doc.commands.updateProps(word, { "content.text": "50% OFF" });
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const text = (id: string) => document.querySelector(`[data-element-id="${id}"] [data-live-fill]`)?.textContent ?? "";
    return [text(a), text(b)];
  }, ids);
  expect(seen).toEqual(["50% OFF", "50% OFF"]);

  // clicking inside a fill selects the shape it fills, not the badge
  const box = (await page.locator(`[data-element-id="${ids.a}"]`).first().boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LL_SELECTION__?: () => string[] }).__LL_SELECTION__?.() ?? null)).toEqual([ids.a]);

  const html = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => f.text ?? "").join("\n");
  });
  expect((html.match(/<foreignObject[\s\S]*?50% OFF[\s\S]*?<\/foreignObject>/g) ?? []).length).toBeGreaterThanOrEqual(2);
});

test("a lens shows what is under its shape, magnified, and keeps it lined up as the shape follows the pointer", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const ids = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const words = doc.commands.addLayer({ archetype: "container", parentId: frame.id, name: "Words", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 200, "frame.width": 1000, "frame.height": 200, "appearance.background.color": "transparent", "layout.display": "block" } });
    doc.commands.addLayer({ archetype: "text", parentId: words, properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "content.text": "One Design", "typography.fontSize": 160, "typography.color": "#111111" } });
    const lens = doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, name: "Lens", properties: { positioning: "absolute", "frame.x": 300, "frame.y": 200, "frame.width": 200, "frame.height": 200, "paint.fills": JSON.stringify([{ type: "solid", color: "#ffffff" }]) } });
    (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === "selection.set")!.run({ ids: [lens] });
    return { words, lens };
  });
  // the lens is set up from the fill's own controls
  await page.getByRole("button", { name: "Fill 1 color" }).click();
  const dlg = page.getByRole("dialog", { name: "Fill 1" });
  await dlg.getByRole("radiogroup", { name: "Fill type" }).getByRole("radio", { name: /^Live/ }).click();
  await dlg.getByRole("combobox", { name: "Live fill source" }).click();
  await page.getByRole("option", { name: "Words" }).click();
  await dlg.getByLabel("Live fill lens").click();
  const magnify = dlg.getByLabel("Live fill magnification");
  await magnify.fill("200");
  await magnify.press("Enter");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties["paint.fills"], ids.lens)).toContain('"lens":true');

  // the copy inside the lens is magnified about the lens's centre: the source point under the centre stays under it
  const centreCheck = () =>
    page.evaluate(({ words, lens }) => {
      const L = document.querySelector(`[data-testid="stage-page"] [data-archetype][data-element-id="${lens}"]`)!.getBoundingClientRect();
      const src = Array.from(document.querySelectorAll(`[data-testid="stage-page"] [data-archetype][data-element-id="${words}"]`)).find((el) => !el.closest("[data-live-fill]"))!.getBoundingClientRect();
      const copy = document.querySelector("[data-live-lens]")!.querySelector(`[data-element-id$="${words}"]`)!.getBoundingClientRect();
      const cx = L.left + L.width / 2;
      // where the centre falls in the source (0-1), and in the copy: the same place
      return { src: (cx - src.left) / src.width, copy: (cx - copy.left) / copy.width, scale: copy.width / src.width };
    }, ids);
  await expect.poll(async () => { const c = await centreCheck(); return Math.abs(c.src - c.copy) < 0.01 && Math.abs(c.scale - 2) < 0.02; }).toBe(true);

  // it follows the pointer and stays lined up
  await page.getByTestId("right-panel").getByRole("button", { name: "Follow the pointer" }).click();
  await page.getByRole("tab", { name: "Motion" }).click();
  const box = (await page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${ids.words}"]`).first().boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5, { steps: 8 });
  await page.waitForTimeout(800);
  await expect.poll(async () => { const c = await centreCheck(); return Math.abs(c.src - c.copy) < 0.01 && c.src > 0.55; }).toBe(true);
});
