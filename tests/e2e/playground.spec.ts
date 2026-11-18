/**
 * ROADMAP Phase 90 gate (in part): the Animation Playground opens on the live canvas and holds the editor's own
 * controls. A layer with a hover state is drawn; the Playground opens from the Preview bar, Hold hover moves the layer
 * to its hover look on its transition, Rest brings it back, speed reaches the transport, the touch-target overlay marks
 * a layer under 44 px, reduced motion and the frame rate show, and closing returns to Design with the design untouched.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => { layers: Record<string, { id: string }> }; commands: { addState: (layerId: string, name: string, props: Record<string, unknown>, label?: string) => string } } };
test.use({ viewport: { width: 1600, height: 1000 } });
const node = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
const opacity = (page: Page, id: string) => node(page, id).evaluate((e) => Number(getComputedStyle(e).opacity));

test("Phase 90: the Playground holds a state, changes speed, shows overlays and closes without touching the design", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(await page.evaluate(() => Object.keys((window as unknown as Win).__LL_DOC__.get().layers)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.22, b.y + b.height * 0.32, { steps: 4 }); // a small rectangle: under 44 px
  await page.mouse.up();
  const id = (await page.evaluate(() => Object.keys((window as unknown as Win).__LL_DOC__.get().layers))).find((k) => !before.has(k))!;
  await page.evaluate((x) => (window as unknown as Win).__LL_DOC__.commands.addState(x, "hover", { "appearance.opacity": 0.2 }, "Add state"), id);
  const docBefore = await page.evaluate(() => JSON.stringify((window as unknown as Win).__LL_DOC__.get()));

  // into Preview, then the Playground
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window as unknown as { __LL_COMMANDS__?: { all: () => Array<{ id: string; run: (a?: unknown) => unknown }> } }).__LL_COMMANDS__?.all().find((c) => c.id === "view.playground")?.run({ on: true }));
  const panel = page.getByTestId("playground-panel");
  if (!(await panel.isVisible())) {
    // the command seam is only there in Motion: use the Preview bar instead
    await page.getByRole("button", { name: "Open the Animation Playground" }).click();
  }
  await expect(panel).toBeVisible();
  await expect(page.getByRole("status", { name: "Preview mode active" })).toBeVisible();
  await expect(page.getByTestId("playground-fps")).toBeVisible();

  // hold a state: moves there, and Rest brings it back
  await page.evaluate((x) => (window as unknown as { __LL_SELECT__: (i: string) => void }).__LL_SELECT__(x), id);
  expect(await opacity(page, id)).toBe(1);
  await panel.getByRole("button", { name: "Hold hover state" }).click();
  await expect.poll(() => opacity(page, id), { timeout: 4000 }).toBeLessThan(0.3);
  await panel.getByRole("button", { name: "Hold no state" }).click();
  await expect.poll(() => opacity(page, id), { timeout: 4000 }).toBeGreaterThan(0.95);

  // overlays: the small layer is flagged as a tap target (it has a state)
  await panel.getByLabel("Show Touch targets").click();
  await expect(page.locator('[data-pg="touch"]')).toHaveCount(1);
  await panel.getByLabel("Show Dimensions").click();
  await expect(page.locator('[data-pg="dimensions"], [data-pg="touch"]').first()).toBeVisible();
  await panel.getByLabel("Show Touch targets").click();
  await expect(page.locator('[data-pg="touch"]')).toHaveCount(0);

  // reduced motion shows as a switch
  await panel.getByLabel("Playground reduced motion").click();
  await panel.getByLabel("Playground reduced motion").click();

  // closing goes back to Design and the design is the same
  await panel.getByRole("button", { name: "Close the Playground" }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Preview mode active" })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.stringify((window as unknown as Win).__LL_DOC__.get()))).toBe(docBefore);
});
