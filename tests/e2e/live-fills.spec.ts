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
