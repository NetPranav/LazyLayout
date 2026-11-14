/**
 * Phases 74, 75 and 77 in the new editor's inspector (/editor):
 * - 74: the Compositing section isolates a group, masks the layer, and uses another layer as its matte; one undo step each.
 * - 75: the Effect stack section adds, edits, reorders, switches off and removes effects, shows each one's route, and
 *   turns motion blur on with a shutter angle.
 * - 77: an expression is converted to keyframes from the Parent & links section.
 * Every control calls the command the engine phase registered, so the checks read the document and the drawn layer.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor, pickShape } from "./support/editor";

type L = { id: string; name: string; motionBlur?: boolean; properties: Record<string, unknown> };
type Doc = { layers: Record<string, L>; clips: Record<string, { layerId: string; tracks: Array<{ property: string; keyframes: unknown[] }> }> };
const doc = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as unknown as { __LL_DOC__: { get: () => Doc } }).__LL_DOC__.get())) as Doc);
const props = async (page: Page, id: string) => (await doc(page)).layers[id].properties;
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first();
const css = (page: Page, id: string, name: string) => drawn(page, id).evaluate((el, n) => getComputedStyle(el).getPropertyValue(n as string), name);

test.use({ viewport: { width: 1600, height: 1000 } });

async function two(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  const made: L[] = [];
  for (const [x1, y1, x2, y2] of [[0.15, 0.2, 0.3, 0.35], [0.55, 0.5, 0.7, 0.65]]) {
    const before = new Set(Object.keys((await doc(page)).layers));
    await pickShape(page, "Rectangle");
    await page.mouse.move(b.x + b.width * x1, b.y + b.height * y1);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * x2, b.y + b.height * y2, { steps: 4 });
    await page.mouse.up();
    made.push(Object.values((await doc(page)).layers).find((l) => !before.has(l.id))!);
  }
  return { a: made[0], b: made[1] };
}
const select = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`).click();
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
/** Undo with the focus on the app, not in a field (where Ctrl+Z is the field's own). */
const undo = async (page: Page) => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
};

test("Phase 74 in the inspector: isolate, a mask and a matte are set from the Compositing section", async ({ page }) => {
  const { a, b } = await two(page);
  await select(page, b.id);
  const section = page.locator('[data-section="compositing"]');
  await section.scrollIntoViewIfNeeded();

  // isolate
  await page.getByRole("button", { name: "Isolate group", exact: true }).click();
  await expect.poll(async () => (await props(page, b.id))["appearance.isolation"]).toBe("isolate");
  expect(await css(page, b.id, "isolation")).toBe("isolate");
  await undo(page);
  await expect.poll(async () => (await props(page, b.id))["appearance.isolation"] ?? "auto").toBe("auto");

  // a mask: an ellipse, feathered; the drawn layer carries a mask image
  await select(page, b.id);
  await chooseOption(page, "Mask mode", "Alpha");
  await expect.poll(async () => (await props(page, b.id))["mask.mode"]).toBe("alpha");
  await chooseOption(page, "Mask shape", "Ellipse");
  await set(page, "Mask feather", 6);
  await expect.poll(async () => (await props(page, b.id))["mask.feather"]).toBe(6);
  expect((await props(page, b.id))["mask.shape"]).toBe("ellipse");
  await expect.poll(async () => (await css(page, b.id, "mask-image")) || (await css(page, b.id, "-webkit-mask-image"))).toContain("url(");
  // opacity is a percentage in the panel and 0 to 1 in the document
  await set(page, "Mask opacity", 40);
  await expect.poll(async () => (await props(page, b.id))["mask.opacity"]).toBe(0.4);
  await chooseOption(page, "Mask mode", "None");
  await expect(page.getByLabel("Mask shape", { exact: true })).toHaveCount(0);

  // a matte: the other layer; choosing it sets the usual mode, and a layer can't be picked as its own matte (it isn't listed)
  await chooseOption(page, "Matte source layer", a.name);
  await expect.poll(async () => (await props(page, b.id))["matte.source"]).toBe(a.id);
  expect((await props(page, b.id))["matte.mode"]).toBe("alpha");
  await chooseOption(page, "Matte mode", "Luma");
  await expect.poll(async () => (await props(page, b.id))["matte.mode"]).toBe("luma");
  await page.getByRole("button", { name: "Show matte source", exact: true }).click();
  await expect.poll(async () => (await props(page, b.id))["matte.showSource"]).toBe(true);
  await chooseOption(page, "Matte source layer", "None");
  await expect.poll(async () => (await props(page, b.id))["matte.mode"]).toBe("none");

  // an adjustment: what is behind is blurred through the layer
  await page.getByRole("button", { name: "Adjust what is behind", exact: true }).click();
  await set(page, "Adjust blur", 12);
  await expect.poll(async () => (await props(page, b.id))["adjust.blur"]).toBe(12);
  await expect.poll(async () => (await css(page, b.id, "backdrop-filter")) || (await css(page, b.id, "-webkit-backdrop-filter"))).toContain("blur(12px)");
  await set(page, "Adjust saturation", 50);
  await expect.poll(async () => (await props(page, b.id))["adjust.saturate"]).toBe(0.5);
});

test("Phase 75 in the inspector: the effect stack is built, edited, reordered and removed; motion blur has a shutter", async ({ page }) => {
  const { b } = await two(page);
  await select(page, b.id);
  const section = page.locator('[data-section="effect-stack"]');
  await section.scrollIntoViewIfNeeded();

  await chooseOption(page, "Add stack effect", "Blur");
  await expect.poll(async () => (await props(page, b.id))["fx.1.type"]).toBe("blur");
  await expect.poll(() => css(page, b.id, "filter")).toContain("blur(8px)");
  await expect(section.locator('[data-fx-slot="1"] [data-fx-route]')).toHaveAttribute("data-fx-route", "css");

  await set(page, "Blur 1 radius", 12);
  await expect.poll(async () => (await props(page, b.id))["fx.1.radius"]).toBe(12);
  await expect.poll(() => css(page, b.id, "filter")).toContain("blur(12px)");

  // a second effect, moved above the first: the slots swap, and the drawn order follows
  await chooseOption(page, "Add stack effect", "Drop shadow");
  await expect.poll(async () => (await props(page, b.id))["fx.2.type"]).toBe("dropShadow");
  await page.getByRole("button", { name: "Move effect 2 up", exact: true }).click();
  await expect.poll(async () => (await props(page, b.id))["fx.1.type"]).toBe("dropShadow");
  expect((await props(page, b.id))["fx.2.type"]).toBe("blur");
  const filter = await css(page, b.id, "filter");
  expect(filter.indexOf("drop-shadow")).toBeGreaterThanOrEqual(0);
  expect(filter.indexOf("drop-shadow")).toBeLessThan(filter.indexOf("blur("));
  await undo(page);
  await expect.poll(async () => (await props(page, b.id))["fx.1.type"]).toBe("blur");

  // off, then removed
  await select(page, b.id);
  await page.getByRole("button", { name: "Stack effect 2 on", exact: true }).click();
  await expect.poll(async () => (await props(page, b.id))["fx.2.enabled"]).toBe(false);
  await expect.poll(() => css(page, b.id, "filter")).not.toContain("drop-shadow");
  await page.getByRole("button", { name: "Remove stack effect 2", exact: true }).click();
  await expect.poll(async () => (await props(page, b.id))["fx.2.type"]).toBeUndefined();

  // an SVG-routed effect says so, with the reason
  await chooseOption(page, "Add stack effect", "Noise");
  await expect(section.locator('[data-fx-type="noise"] [data-fx-route]')).toHaveAttribute("data-fx-route", "svg");
  await expect(section).toContainText("feTurbulence");

  // motion blur: the layer's switch, then its shutter angle
  await page.getByRole("button", { name: "Motion blur", exact: true }).click();
  await expect.poll(async () => (await doc(page)).layers[b.id].motionBlur).toBe(true);
  await set(page, "Shutter angle", 360);
  await expect.poll(async () => (await props(page, b.id))["motion.shutterAngle"]).toBe(360);
});

test("Phase 77 in the inspector: an expression is converted to keyframes", async ({ page }) => {
  const { a } = await two(page);
  await select(page, a.id);
  await page.getByLabel("Expression text", { exact: true }).fill("time * 40");
  await page.getByRole("button", { name: "Set expression", exact: true }).click();
  await expect(page.locator("[data-expression-slot]")).toContainText("time * 40");

  await page.getByRole("button", { name: "Convert expression Rotation to keyframes", exact: true }).click();
  await expect(page.locator("[data-expression-slot]")).toHaveCount(0);
  const after = await doc(page);
  expect(after.layers[a.id].properties["expr.1.text"]).toBeUndefined();
  const track = Object.values(after.clips).filter((c) => c.layerId === a.id).flatMap((c) => c.tracks).find((t) => t.property === "transform.rotate");
  expect(track, "the rotation now has a keyframe track").toBeTruthy();
  expect(track!.keyframes.length).toBeGreaterThan(10);
});
