/**
 * A fill has one panel, as in Figma's fill picker: the swatch (or the colour field) opens it beside the inspector, the
 * kinds of fill are icons along its top, and every option of the fill (gradient stops, picture, noise, pattern, mesh,
 * live, blend and mask) is in that same panel. There is no second settings button on the row.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };

test.use({ viewport: { width: 1600, height: 1000 } });

async function rectangle(page: Page): Promise<string> {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string } } }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    return doc.commands.addLayer({ archetype: "rectangle", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 200, "frame.height": 120, "svg.stroke": "none" } });
  });
  await page.evaluate((id) => {
    const reg = (window as unknown as { __LL_COMMANDS__: { all: () => { id: string; run: (a?: unknown) => unknown }[] } }).__LL_COMMANDS__;
    reg.all().find((c) => c.id === "selection.set")!.run({ ids: [id] });
  }, id);
  return id;
}

const fillsOf = async (page: Page, id: string) =>
  JSON.parse(String((await page.evaluate((id) => (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers[id].properties["paint.fills"], id)) || "[]")) as { type: string; blend?: string }[];

test("a fill has one panel with every kind and option in it", async ({ page }) => {
  const id = await rectangle(page);
  const row = page.locator('[data-k="fill"]').first();
  await expect(row).toBeVisible();
  await expect(row.getByRole("button", { name: /settings/ }), "no second settings button").toHaveCount(0);

  await row.getByRole("button", { name: "Fill 1 color" }).click();
  const panel = page.getByRole("dialog", { name: "Fill 1" });
  await expect(panel).toBeVisible();
  // it opens beside the inspector, on its left
  const right = (await page.getByTestId("right-panel").boundingBox().catch(() => null)) ?? null;
  // (polled: the panel grows in from the swatch as it opens)
  if (right) await expect.poll(async () => { const b = (await panel.boundingBox())!; return b.x + b.width; }).toBeLessThanOrEqual(right.x + 1);

  const types = panel.getByRole("radiogroup", { name: "Fill type" });
  for (const name of ["Solid", "Gradient", "Image", /^Pattern/, /^Noise/, /^Mesh/, /^Live/]) await expect(types.getByRole("radio", { name })).toBeVisible();
  // blend and mask are in the same panel
  await expect(panel.getByRole("combobox", { name: "Fill blend mode" })).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Fill mask" })).toBeVisible();
  // blend writes the fill
  await panel.getByRole("combobox", { name: "Fill blend mode" }).click();
  await page.getByRole("option", { name: "Multiply" }).click();
  await expect.poll(async () => (await fillsOf(page, id))[0]?.blend).toBe("multiply");
  await expect(page.getByRole("listbox")).toHaveCount(0);

  // Gradient: its kind, the stops by number
  await types.getByRole("radio", { name: "Gradient" }).click();
  await expect.poll(async () => (await fillsOf(page, id))[0]?.type).toBe("linear");
  await expect(panel.getByRole("combobox", { name: "Gradient kind" })).toBeVisible();
  await expect(panel.getByLabel("Stop 1 position")).toBeVisible();
  await panel.getByRole("combobox", { name: "Gradient kind" }).click();
  await page.getByRole("option", { name: "Radial" }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect.poll(async () => (await fillsOf(page, id))[0]?.type).toBe("radial");
  await expect(panel, "the panel stays open while the kind changes").toBeVisible();

  // Pattern, Noise, Mesh: their own options, in the same panel
  await types.getByRole("radio", { name: /^Pattern/ }).click();
  await expect(panel.getByLabel("Pattern scale")).toBeVisible();
  await types.getByRole("radio", { name: /^Noise/ }).click();
  await expect(panel.getByLabel("Noise size")).toBeVisible();
  await expect(panel.getByRole("slider", { name: "Saturation and brightness" }), "a noise has a colour").toBeVisible();
  await types.getByRole("radio", { name: /^Mesh/ }).click();
  await expect(panel.getByLabel("Mesh columns")).toBeVisible();
  await expect(panel.getByRole("slider", { name: "Saturation and brightness" }), "a mesh's colours are its points").toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
});
