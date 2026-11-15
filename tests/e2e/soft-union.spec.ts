/**
 * ROADMAP Phase 108 (and Phase 104's controls) in the new editor: two circles made into a live union group, the
 * Boolean group section's Softness melts them together on the canvas and in the export, and Flatten makes one path.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    return reg.all().find((c) => c.id === id)!.run(args);
  }, { id, args });

test.use({ viewport: { width: 1600, height: 1000 } });

test("Softness melts a union group's circles together on the canvas and in the export; Flatten makes one path", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();

  // two circles 8 px apart, inside the page's first frame
  const ids = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const all = Object.values(doc.get().layers);
    const frame = all.find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const circle = (x: number) =>
      doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": x, "frame.y": 40, "frame.width": 80, "frame.height": 80, "svg.fill": "#111111" } });
    return [circle(40), circle(128)];
  });
  const made = (await run(page, "boolean.makeGroup", { ids, operation: "union" })) as { id: string };
  const g = made.id;
  expect(g).toBeTruthy();
  await run(page, "selection.set", { ids: [g] });

  const section = page.getByTestId("boolean-group-section");
  await expect(section).toBeVisible();
  const pathD = () => page.locator(`[data-element-id="${g}"][data-boolean] > svg path`).first().getAttribute("d");
  const hard = await pathD();
  expect(hard).toMatch(/^M/);

  await page.getByLabel("Softness", { exact: true }).fill("10");
  await page.getByLabel("Softness", { exact: true }).press("Enter");
  await expect.poll(async () => (await layers(page))[g].properties["boolean.softness"]).toBe(10);
  // the canvas redraws one melted outline (one subpath instead of two)
  await expect.poll(async () => ((await pathD()) ?? "").match(/M/g)?.length ?? 0).toBe(1);
  expect(await pathD()).not.toBe(hard);

  // the export draws the same melted path
  const exported = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const r = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return r.files.map((f) => f.text ?? "").join("\n");
  });
  const melted = (await pathD())!;
  expect(exported).toContain(melted.slice(0, 40));

  // Flatten: one path layer, the circles gone, one undo step back
  await page.getByRole("button", { name: "Flatten boolean group" }).click();
  await expect.poll(async () => !!(await layers(page))[ids[0]]).toBe(false);
});
