/**
 * ROADMAP Phases 109–110 in the new editor: the Modifiers section on a rectangle. Add a Repeat and set its copies,
 * switch it off and on, add a Round corners and move it above the Repeat, remove one; the canvas and the export follow.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    return reg.all().find((c) => c.id === id)!.run(args);
  }, { id, args });
const stack = async (page: Page, id: string) => JSON.parse(String((await layers(page))[id].properties["shape.modifiers"] || "[]")) as { type: string; on: boolean; params: Record<string, unknown> }[];

test.use({ viewport: { width: 1600, height: 1000 } });

test("a rectangle's Repeat and Round corners modifiers: add, change, switch off, reorder and remove, on the canvas and in the export", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 60, "frame.height": 40, "svg.fill": "#222222" } });
  });
  await run(page, "selection.set", { ids: [id] });
  const drawn = page.locator(`[data-element-id="${id}"]`).first();
  await expect(page.getByTestId("modifiers-section")).toBeVisible();

  // add a Repeat: the rectangle is drawn as a path with three copies
  await page.getByRole("combobox", { name: "Add modifier" }).click();
  await page.getByRole("option", { name: "Repeat" }).click();
  await expect.poll(async () => (await stack(page, id)).map((m) => m.type)).toEqual(["repeat"]);
  await page.getByLabel("Repeat Step X", { exact: true }).fill("80");
  await page.getByLabel("Repeat Step X", { exact: true }).press("Tab");
  const pathD = () => drawn.locator("path").first().getAttribute("d");
  await expect.poll(async () => ((await pathD()) ?? "").match(/M/g)?.length ?? 0).toBe(3);
  await page.getByLabel("Repeat Copies", { exact: true }).fill("5");
  await page.getByLabel("Repeat Copies", { exact: true }).press("Tab");
  await expect.poll(async () => ((await pathD()) ?? "").match(/M/g)?.length ?? 0).toBe(5);

  // the export draws the same path
  const exported = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => f.text ?? "").join("\n");
  });
  expect(exported).toContain(((await pathD()) ?? "").slice(0, 30));

  // switched off: back to the plain rectangle; on again: the copies
  await page.getByLabel("Repeat on", { exact: true }).click();
  await expect.poll(async () => (await stack(page, id))[0].on).toBe(false);
  await expect(drawn.locator("rect").first()).toBeVisible();
  await page.getByLabel("Repeat on", { exact: true }).click();
  await expect.poll(async () => ((await pathD()) ?? "").match(/M/g)?.length ?? 0).toBe(5);

  // a Round corners below it, moved above it; then removed
  await page.getByRole("combobox", { name: "Add modifier" }).click();
  await page.getByRole("option", { name: "Round corners" }).click();
  await expect.poll(async () => (await stack(page, id)).map((m) => m.type)).toEqual(["repeat", "round"]);
  await page.getByRole("button", { name: "Move Round corners up" }).click();
  await expect.poll(async () => (await stack(page, id)).map((m) => m.type)).toEqual(["round", "repeat"]);
  await expect.poll(async () => ((await pathD()) ?? "").includes("C")).toBe(true);
  await page.getByRole("button", { name: "Remove Round corners" }).click();
  await expect.poll(async () => (await stack(page, id)).map((m) => m.type)).toEqual(["repeat"]);
});
