/**
 * Design track D11 (Phase 81 on the new editor): scroll scenes. A layer follows the scroll, plays when it comes into view, or is
 * pinned while its section scrolls past, in a previewed frame.
 */
import { test, expect, type Page } from "@playwright/test";
import { chooseOption, openEditor } from "./support/editor";

type Win = { __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null }> }; commands: { addLayer: (a: unknown) => string } } };
test.use({ viewport: { width: 1600, height: 1000 } });

async function tallPage(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    const el = page.getByText(name, { exact: true }).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click();
      await page.keyboard.press("Delete");
    }
  }
  await page.getByText("Design", { exact: true }).click();
  await page.getByRole("menuitem", { name: /Desktop/i }).click();
  return page.evaluate(() => {
    const w = window as unknown as Win;
    const frame = Object.values(w.__LL_DOC__.get().layers).find((l) => l.archetype === "container" && l.parentId !== null)!.id;
    const add = (name: string, y: number, h: number) => w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name, properties: { positioning: "absolute", "frame.x": 300, "frame.y": y, "frame.width": 200, "frame.height": h } });
    return { frame, a: add("A", 100, 120), b: add("B", 1000, 200), c: add("C", 2600, 120) };
  });
}
const selectRow = (page: Page, id: string) => page.evaluate((x) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(x), id);
const num = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const preview = async (page: Page, frame: string) => {
  await page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${frame}"]`).click();
  const scroller = page.locator('[data-testid="frame-preview-scroller"]').first();
  await expect(scroller).toBeAttached({ timeout: 15000 });
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
  return scroller;
};
const scrollTo = (scroller: import("@playwright/test").Locator, y: number) => scroller.evaluate((e, top) => ((e as HTMLElement).scrollTop = top), y);

test.describe("Scroll scenes (D11)", () => {
  test("a layer that follows the scroll tracks the view-progress formula, and goes back when the page does", async ({ page }) => {
    const ids = await tallPage(page);
    await selectRow(page, ids.a);
    await chooseOption(page, "Scroll property", "Position Y");
    await num(page, "Scroll to", -300);
    await page.getByRole("button", { name: "Add scroll animation", exact: true }).click();
    await expect(page.locator("[data-scroll-clip]")).toContainText("Follows scroll · Position Y");

    const scroller = await preview(page, ids.frame);
    const vh = await scroller.evaluate((e) => (e as HTMLElement).clientHeight);
    const el = page.locator(`[data-testid="stage-page"] [data-element-id="${ids.a}"]`).first();
    const dy = () => el.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).f);
    // the default range is from the layer's top meeting the bottom of the screen to its bottom leaving the top
    const progress = (s: number) => Math.min(1, Math.max(0, (s + vh - 100) / (vh + 120)));
    for (const s of [0, 100, 250, 1500]) {
      await scrollTo(scroller, s);
      await expect.poll(async () => Math.abs((await dy()) - -300 * progress(s)), { message: `scrolled to ${s}`, timeout: 8000 }).toBeLessThan(5);
    }
    await scrollTo(scroller, 0);
    await expect.poll(async () => Math.abs((await dy()) - -300 * progress(0)), { timeout: 8000 }).toBeLessThan(5); // and back again

    // out of the preview the layer is as designed
    await page.locator(`[data-testid="frame-preview-toggle"][data-frame-id="${ids.frame}"]`).click();
    await expect.poll(async () => Math.abs(await dy()), { timeout: 8000 }).toBeLessThan(0.5);
  });

  test("a reveal plays once when the layer comes into view", async ({ page }) => {
    const ids = await tallPage(page);
    await selectRow(page, ids.c);
    await chooseOption(page, "Scroll property", "Opacity");
    await chooseOption(page, "Scroll mode", "Plays when seen");
    await page.getByRole("button", { name: "Add scroll animation", exact: true }).click();
    await expect(page.locator("[data-scroll-clip]")).toContainText("Reveal · Opacity");

    const scroller = await preview(page, ids.frame);
    const opacity = () => page.locator(`[data-testid="stage-page"] [data-element-id="${ids.c}"]`).first().evaluate((e) => parseFloat(getComputedStyle(e).opacity));
    await expect.poll(opacity, { message: "not yet seen: it waits invisible" }).toBeLessThan(0.05);
    await scrollTo(scroller, 5000); // to the bottom
    await expect.poll(opacity, { message: "seen: it plays in", timeout: 8000 }).toBeGreaterThan(0.95);
  });

  test("a pinned layer holds still while its section scrolls past, then scrolls on", async ({ page }) => {
    const ids = await tallPage(page);
    await selectRow(page, ids.b);
    await chooseOption(page, "Scroll property", "Opacity");
    await num(page, "Scroll from", 1);
    await num(page, "Scroll to", 1);
    await page.getByLabel("Scroll start", { exact: true }).fill("top top");
    await page.getByLabel("Scroll end", { exact: true }).fill("bottom top");
    await page.getByRole("button", { name: "Pin while scrolling", exact: true }).click();
    await page.getByRole("button", { name: "Add scroll animation", exact: true }).click();
    await expect(page.locator("[data-scroll-clip]")).toContainText("pinned");

    const scroller = await preview(page, ids.frame);
    const frameBox = async () => (await page.locator(`[data-testid="stage-page"] [data-element-id="${ids.frame}"]`).first().boundingBox())!;
    const k = (await frameBox()).width / 1440;
    const top = async () => (await page.locator(`[data-testid="stage-page"] [data-element-id="${ids.b}"]`).first().boundingBox())!.y - (await frameBox()).y;
    // the layer's top meets the screen's top at scroll 1000, and is held until its bottom does, 200 px later
    await scrollTo(scroller, 1000);
    await expect.poll(async () => Math.abs((await top()) - 0), { timeout: 8000 }).toBeLessThan(3 * k + 1);
    await scrollTo(scroller, 1150);
    await expect.poll(async () => Math.abs(await top()), { message: "held", timeout: 8000 }).toBeLessThan(3 * k + 1);
    await scrollTo(scroller, 1500); // 300 px past the end of the hold: it has scrolled 300 up
    await expect.poll(async () => Math.abs((await top()) - -300 * k), { message: "scrolls on", timeout: 8000 }).toBeLessThan(4 * k + 1);
  });

  test("the scroll simulator scrubs the page: the slider and real scrolling give the same result", async ({ page }) => {
    const ids = await tallPage(page);
    await selectRow(page, ids.a);
    await chooseOption(page, "Scroll property", "Position Y");
    await num(page, "Scroll to", -300);
    await page.getByRole("button", { name: "Add scroll animation", exact: true }).click();
    await page.getByRole("button", { name: "Preview the page to scrub its scroll", exact: true }).click();
    const scroller = page.locator('[data-testid="frame-preview-scroller"]').first();
    await expect(scroller).toBeAttached({ timeout: 15000 });
    await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
    const el = page.locator(`[data-testid="stage-page"] [data-element-id="${ids.a}"]`).first();
    const dy = () => el.evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).f);
    const slider = page.getByLabel("Scroll position", { exact: true });
    await slider.fill("400");
    await expect.poll(() => scroller.evaluate((e) => (e as HTMLElement).scrollTop), { timeout: 5000 }).toBeGreaterThan(0);
    const top = await scroller.evaluate((e) => (e as HTMLElement).scrollTop);
    await page.waitForTimeout(300);
    const fromSlider = await dy();
    // scroll away and back to the same place by hand
    await scrollTo(scroller, 0);
    await page.waitForTimeout(300);
    await scrollTo(scroller, top);
    await expect.poll(async () => Math.abs((await dy()) - fromSlider), { timeout: 5000 }).toBeLessThan(0.5);
    expect(Math.abs(fromSlider)).toBeGreaterThan(1); // it really moved
  });

  test("snap: a section snaps and the page frame gets a snap type", async ({ page }) => {
    const ids = await tallPage(page);
    await selectRow(page, ids.b);
    await page.getByRole("button", { name: "Snap the page to this layer", exact: true }).click();
    await selectRow(page, ids.frame);
    await page.getByRole("button", { name: "Page snap mandatory", exact: true }).click();
    const props = await page.evaluate((i) => {
      const l = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, { properties: Record<string, unknown> }> } } }).__LL_DOC__.get().layers;
      return [l[i.b].properties["style.custom"], l[i.frame].properties["style.custom"]];
    }, ids);
    expect(props[0]).toContain("scroll-snap-align: start");
    expect(props[1]).toContain("scroll-snap-type: y mandatory");
    const drawn = await page.locator(`[data-testid="stage-page"] [data-element-id="${ids.b}"]`).first().evaluate((e) => getComputedStyle(e).scrollSnapAlign);
    expect(drawn).toContain("start");
  });
});
