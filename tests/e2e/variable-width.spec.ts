/**
 * ROADMAP Phase 119: variable-width strokes. A line tapered at both ends, a swelling curve and a calligraphic circle
 * are drawn as outlined paths; the exported site's outlines match the stage's within 0.5 px. A profile saved in the
 * stroke popover applies to another stroke exactly. Dragging a width handle on the canvas widens the stroke there.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L>; widthProfiles?: { id: string; name: string }[] }; commands: { addLayer: (o: unknown) => string } };

test.use({ viewport: { width: 1600, height: 1000 } });

const frameOf = () => {
  const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
  return Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!.id;
};

async function add(page: Page, archetype: string, props: Record<string, unknown>) {
  return page.evaluate(({ archetype, props, frameSrc }) => {
    const frame = new Function(`return (${frameSrc})()`)() as string;
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    return doc.commands.addLayer({ archetype, parentId: frame, properties: { positioning: "absolute", "svg.stroke": "#111111", ...props } });
  }, { archetype, props, frameSrc: frameOf.toString() });
}

const run = (page: Page, id: string, args: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });

/** The numbers of a path's data. */
const nums = (d: string) => (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);

test("tapered, swelling and calligraphic strokes export as outlines within 0.5 px of the stage", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const taper = await add(page, "line", { "frame.x": 40, "frame.y": 400, "frame.width": 320, "frame.height": 24, "svg.strokeWidth": 14, "stroke.widthProfile": JSON.stringify([{ t: 0, scale: 0 }, { t: 0.2, scale: 1 }, { t: 0.8, scale: 1 }, { t: 1, scale: 0 }]) });
  const swell = await add(page, "svgPath", { "frame.x": 400, "frame.y": 380, "frame.width": 200, "frame.height": 120, "svg.path": "M10 180 C60 20 140 20 190 180", "svg.fill": "none", "svg.strokeWidth": 10, "stroke.widthProfile": JSON.stringify([{ t: 0, scale: 0.35 }, { t: 0.5, scale: 1 }, { t: 1, scale: 0.35 }]) });
  const circle = await add(page, "svgPath", { "frame.x": 640, "frame.y": 380, "frame.width": 140, "frame.height": 140, "svg.path": "M20 100 A80 80 0 1 1 180 100 A80 80 0 1 1 20 100", "svg.fill": "none", "svg.strokeWidth": 12 });
  await run(page, "stroke.calligraphic", { ids: [circle], angle: 30 });

  const outline = (root: Page | import("@playwright/test").Locator) => root.locator('mask[id$="__stroke"] path[fill="#fff"]').first().getAttribute("d");
  const stage = await Promise.all([taper, swell, circle].map((id) => outline(page.locator(`[data-stage=artboard] [data-element-id="${id}"]`).first())));
  expect(stage.every((d) => d && d.length > 200)).toBe(true);

  const html = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => f.text ?? "").join("\n");
  });
  const exported = [...html.matchAll(/<mask id="([^"]+)__stroke"[\s\S]*?<path d="([^"]+)" fill="#fff"/g)].map((m) => m[2]);
  for (const [i, d] of stage.entries()) {
    const a = nums(d!);
    // the exported outline with the same number of coordinates nearest to this one
    const best = exported.map(nums).filter((b) => b.length === a.length).map((b) => Math.max(...b.map((v, k) => Math.abs(v - a[k])))).sort((x, y) => x - y)[0];
    expect(best, `outline ${i + 1}`).toBeLessThanOrEqual(0.5);
  }
});

test("a profile saved in the stroke popover applies to another stroke exactly; a canvas handle widens the stroke", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const a = await add(page, "line", { "frame.x": 60, "frame.y": 300, "frame.width": 360, "frame.height": 20, "svg.strokeWidth": 12 });
  const b = await add(page, "line", { "frame.x": 60, "frame.y": 420, "frame.width": 360, "frame.height": 20, "svg.strokeWidth": 12 });
  const prop = (id: string) => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties["stroke.widthProfile"] ?? "", id);

  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), a);
  await page.getByRole("button", { name: "Stroke 1 settings" }).click();
  await page.getByRole("combobox", { name: "Width profile" }).click();
  await page.getByRole("option", { name: "Taper both ends" }).click();
  await expect.poll(() => prop(a)).toContain('"scale":0');

  // drag the right-side handle of the second point (t 0.2) away from the line: the stroke gets wider there
  await page.getByRole("switch", { name: "Edit stroke width on canvas" }).click();
  const h = page.locator('[data-width-handle="1-right"]');
  await expect(h).toBeVisible();
  const box = (await h.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 12, { steps: 4 });
  await page.mouse.up();
  const after = JSON.parse(String(await prop(a)));
  expect(after[1].scale).toBeGreaterThan(1.5);
  // one undo step brings the preset back
  await page.keyboard.press("Control+z");
  await expect.poll(async () => JSON.parse(String(await prop(a)))[1].scale).toBe(1);

  await page.getByRole("button", { name: "Save profile" }).click();
  await page.getByLabel("Width profile name").fill("Ink taper");
  await page.getByLabel("Width profile name").press("Enter");
  await expect.poll(() => page.evaluate(() => ((window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().widthProfiles ?? []).map((p) => p.name))).toEqual(["Ink taper"]);

  await page.keyboard.press("Escape");
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), b);
  await page.getByRole("button", { name: "Stroke 1 settings" }).click();
  await page.getByRole("combobox", { name: "Width profile" }).click();
  await page.getByRole("option", { name: "Ink taper" }).click();
  await expect.poll(() => prop(b)).toBe(await prop(a));
});
