/**
 * Design track D23: variants and instances in the new editor. Make a component, give it Primary and Secondary variants, insert an
 * instance, switch its variant, override and reset it, and detach it, all from the Component section.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type L = { id: string; name: string; archetype: string; parentId: string | null; componentMain?: string; instance?: { component: string; source: string; root?: boolean; variant?: Record<string, string>; overridden?: string[] }; properties: Record<string, unknown> };
type D = { layers: Record<string, L>; designComponents?: Record<string, { mainId: string; variantProps?: { name: string; values: string[] }[]; variants?: { mainId: string; values: Record<string, string> }[] }> };
test.use({ viewport: { width: 1600, height: 1000 } });
const doc = (page: Page) => page.evaluate(() => (window as unknown as { __LL_DOC__: { get: () => D } }).__LL_DOC__.get());
const select = (page: Page, id: string) => page.evaluate((i) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(i), id);

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  const id = await page.evaluate(() => {
    const d = (window as unknown as { __LL_DOC__: { get: () => D; commands: { addLayer: (a: unknown) => string } } }).__LL_DOC__;
    const hero = Object.values(d.get().layers).find((l) => l.name === "Hero")!;
    return d.commands.addLayer({ archetype: "container", parentId: hero.id, name: "Button", properties: { positioning: "absolute", "frame.x": 40, "frame.y": 40, "frame.width": 160, "frame.height": 48, "appearance.background.color": "#2563eb" } });
  });
  await select(page, id);
  await expect(page.getByTestId("components-section")).toBeVisible();
  return id;
}

test.describe("Components (D23)", () => {
  test("make a component, add Primary and Secondary variants, insert an instance and switch its variant", async ({ page }) => {
    const id = await setup(page);
    await page.getByRole("button", { name: "Create component", exact: true }).click();
    await expect.poll(async () => !!(await doc(page)).layers[id]?.componentMain).toBe(true);
    const compId = (await doc(page)).layers[id].componentMain!;

    await page.getByLabel("Variant property name").fill("Kind");
    await page.getByLabel("Variant values").fill("Primary, Secondary");
    await page.getByRole("button", { name: "Add variant property", exact: true }).click();
    await expect.poll(async () => (await doc(page)).designComponents?.[compId]?.variants?.length ?? 0).toBe(2);
    await expect(page.locator('[data-variant-prop="Kind"]')).toContainText("Primary, Secondary");

    // make the Secondary main look different
    const secondary = (await doc(page)).designComponents![compId].variants!.find((v) => v.values.Kind === "Secondary")!.mainId;
    await page.evaluate((m) => (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: Record<string, unknown>) => void } } }).__LL_DOC__.commands.updateProps(m, { "appearance.background.color": "#f97316" }), secondary);

    await select(page, id);
    await page.getByRole("button", { name: "Insert instance", exact: true }).click();
    await expect.poll(async () => Object.values((await doc(page)).layers).filter((l) => l.instance?.root && l.instance.component === compId).length).toBe(1);
    const inst = Object.values((await doc(page)).layers).find((l) => l.instance?.root && l.instance.component === compId)!;
    await select(page, inst.id);
    await expect(page.getByRole("status").filter({ hasText: "Instance of" })).toBeVisible();

    await chooseOption(page, "Variant Kind", "Secondary");
    await expect.poll(async () => (await doc(page)).layers[inst.id].instance?.variant?.Kind).toBe("Secondary");
    await expect.poll(async () => (await doc(page)).layers[inst.id].instance?.source).toBe(secondary);
    await expect.poll(async () => (await doc(page)).layers[inst.id].properties["appearance.background.color"]).toBe("#f97316");
  });

  test("an override is kept, Reset puts it back, Detach makes ordinary layers", async ({ page }) => {
    const id = await setup(page);
    await page.getByRole("button", { name: "Create component", exact: true }).click();
    await expect.poll(async () => !!(await doc(page)).layers[id]?.componentMain).toBe(true);
    await page.getByRole("button", { name: "Insert instance", exact: true }).click();
    await expect.poll(async () => Object.values((await doc(page)).layers).filter((l) => l.instance?.root).length).toBeGreaterThan(0);
    const inst = Object.values((await doc(page)).layers).find((l) => l.instance?.root)!;
    await page.evaluate((i) => (window as unknown as { __LL_DOC__: { commands: { updateProps: (id: string, p: Record<string, unknown>) => void } } }).__LL_DOC__.commands.updateProps(i, { "appearance.background.color": "#22c55e" }), inst.id);
    await select(page, inst.id);
    await expect(page.getByRole("button", { name: "Reset overrides", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Reset overrides", exact: true }).click();
    await expect.poll(async () => (await doc(page)).layers[inst.id].properties["appearance.background.color"]).toBe("#2563eb");
    await page.getByRole("button", { name: "Detach instance", exact: true }).click();
    await expect.poll(async () => (await doc(page)).layers[inst.id]?.instance).toBeUndefined();
  });
});
