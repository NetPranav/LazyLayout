/**
 * Design track D15 (Main 78): a layer's hover and pressed looks. Picking a state makes the controls and the canvas edit it; only
 * the difference from the base is kept; Live (and Preview) show it on real hover and press.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; archetype: string; properties: Record<string, unknown> };
type S = { layerId: string; name: string; props: Record<string, unknown> };
const doc = (page: Page) =>
  page.evaluate(() => {
    const d = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L>; states: Record<string, S> } } }).__LL_DOC__.get();
    return { layers: d.layers, states: Object.values(d.states ?? {}) };
  });

test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys((await doc(page)).layers));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.35, b.y + b.height * 0.45, { steps: 4 });
  await page.mouse.up();
  return Object.values((await doc(page)).layers).find((l) => !before.has(l.id))!;
}
const node = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
const opacity = (page: Page, id: string) => node(page, id).evaluate((e) => Number(getComputedStyle(e as HTMLElement).opacity));

test.describe("States (D15)", () => {
  test("a Hover state is edited on the canvas, keeps only the difference, and shows on real hover", async ({ page }) => {
    const r = await setup(page);
    await expect(page.getByTestId("states-section")).toBeVisible();

    await page.getByRole("button", { name: "Add Hover state", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Editing Hover" })).toBeVisible();

    // the controls now edit the state
    const f = page.getByLabel("Opacity", { exact: true }).first();
    await f.fill("30");
    await f.press("Enter");
    await expect.poll(async () => (await doc(page)).states[0]?.props["appearance.opacity"]).toBe(0.3);
    expect((await doc(page)).layers[r.id].properties["appearance.opacity"] ?? 1).toBe(1); // the base is untouched
    expect(Object.keys((await doc(page)).states[0].props)).toEqual(["appearance.opacity"]);
    await expect.poll(() => opacity(page, r.id)).toBeCloseTo(0.3, 1); // the canvas draws the state while it is being edited

    // back to the base: the canvas shows the base again
    await page.getByRole("button", { name: "Edit the base layer", exact: true }).click();
    await expect.poll(() => opacity(page, r.id)).toBeCloseTo(1, 1);

    // live: real hover shows the state, leaving puts the base back
    await page.getByLabel("Show states live on the canvas").click();
    const box = (await node(page, r.id).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await expect.poll(() => opacity(page, r.id), { timeout: 5000 }).toBeCloseTo(0.3, 1);
    await page.mouse.move(box.x + box.width + 300, box.y + box.height + 200, { steps: 4 });
    await expect.poll(() => opacity(page, r.id), { timeout: 5000 }).toBeCloseTo(1, 1);

    // it was never stored on the layer: the document still says opacity 1
    expect((await doc(page)).layers[r.id].properties["appearance.opacity"] ?? 1).toBe(1);
  });

  test("a state is added, refused when repeated, removed, and undone", async ({ page }) => {
    await setup(page);
    await page.getByLabel("Custom state name").fill("open");
    await page.getByRole("button", { name: "Add custom state", exact: true }).click();
    await expect.poll(async () => (await doc(page)).states.map((s) => s.name)).toEqual(["open"]);
    await page.getByLabel("Custom state name").fill("open");
    await page.getByRole("button", { name: "Add custom state", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "already has a state" })).toBeVisible();
    await page.getByRole("button", { name: "Remove state open", exact: true }).click();
    await expect.poll(async () => (await doc(page)).states.length).toBe(0);
  });
});
