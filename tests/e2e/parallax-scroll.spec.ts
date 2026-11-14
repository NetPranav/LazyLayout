/**
 * Design track D14: depth parallax and smooth scrolling, in the exported page. Reduced motion turns both off.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openEditor } from "./support/editor";

type Win = { __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null }> }; commands: { addLayer: (a: unknown) => string } } };
test.use({ viewport: { width: 1600, height: 1000 } });

/** A page that is taller than the screen, with a layer near the top and one far down. */
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
    const add = (name: string, x: number, y: number) => w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": 200, "frame.height": 120 } });
    return { back: add("Back", 300, 200), foot: add("Foot", 300, 2600) };
  });
}
const exportTo = async (page: Page, dir: string) => {
  const built = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
    return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
  });
  for (const f of built.files) {
    if (f.text === undefined) continue;
    mkdirSync(dirname(join(dir, f.path)), { recursive: true });
    writeFileSync(join(dir, f.path), f.text);
  }
  return built;
};

test.describe("Parallax and smooth scrolling (D14)", () => {
  test("a layer at depth 0.3 drifts at 0.7 of the page's speed in the exported page, and stays put for reduced motion", async ({ page, browser }, testInfo) => {
    const ids = await tallPage(page);
    await page.locator(`[data-testid="stage-element"][data-element-id="${ids.back}"]`).click();
    await expect(page.getByLabel("Parallax depth", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add parallax", exact: true }).click();
    await expect(page.locator("[data-driver-id]")).toContainText("Parallax (scroll)");

    const dir = testInfo.outputPath("export-parallax");
    const built = await exportTo(page, dir);
    expect(built.warnings.filter((w) => /driver/i.test(w))).toEqual([]);

    const open = async (reduced: boolean) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      return { ctx, p };
    };
    const shift = (p: Page) => p.locator(`[data-ll="${ids.back}"]`).evaluate((e) => parseFloat(((e as HTMLElement).style.translate || "0px").split(" ")[1] ?? "0")); // (the browser prints "0px 0px" as "0px")

    const live = await open(false);
    for (const y of [0, 400, 1000, 1800]) {
      await live.p.evaluate((top) => window.scrollTo(0, top), y);
      await live.p.waitForTimeout(250);
      const at = await live.p.evaluate(() => window.scrollY);
      expect(Math.abs((await shift(live.p)) - 0.3 * at), `scrolled to ${at}`).toBeLessThan(1);
    }
    await live.ctx.close();

    const still = await open(true);
    await still.p.evaluate(() => window.scrollTo(0, 1000));
    await still.p.waitForTimeout(300);
    expect(await shift(still.p), "reduced motion: the layer scrolls with the page").toBe(0);
    await still.ctx.close();
  });

  test("smooth scrolling eases the wheel, leaves the keyboard alone, and is off for reduced motion", async ({ page, browser }, testInfo) => {
    await tallPage(page);
    await page.mouse.click(300, 150); // empty canvas, outside the frame: the Page panel
    const field = page.getByLabel("Smooth scrolling", { exact: true });
    await expect(field).toBeVisible();
    await field.fill("0.25");
    await field.press("Enter");

    const dir = testInfo.outputPath("export-smooth");
    const built = await exportTo(page, dir);
    expect(built.files.some((f) => f.path === "lazylayout-smooth.js")).toBe(true);
    expect(built.files.find((f) => f.path === "index.html")!.text).toContain("lazylayout-smooth.js");

    const open = async (reduced: boolean) => {
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
      const p = await ctx.newPage();
      await p.goto(`file://${join(dir, "index.html")}`);
      await p.mouse.move(600, 400);
      return { ctx, p };
    };
    const y = (p: Page) => p.evaluate(() => window.scrollY);

    const smooth = await open(false);
    await smooth.p.mouse.wheel(0, 600);
    await smooth.p.waitForTimeout(60);
    const early = await y(smooth.p);
    expect(early, "after 60 ms the page is on its way, not there").toBeGreaterThan(0);
    expect(early).toBeLessThan(590);
    await smooth.p.waitForTimeout(1500);
    expect(Math.abs((await y(smooth.p)) - 600), "and it arrives").toBeLessThan(2);
    // the keyboard is the browser's: End goes to the bottom, and the next wheel starts from there
    await smooth.p.keyboard.press("End");
    await smooth.p.waitForTimeout(1200);
    const bottom = await smooth.p.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(Math.abs((await y(smooth.p)) - bottom)).toBeLessThan(2);
    await smooth.p.mouse.wheel(0, -300);
    await smooth.p.waitForTimeout(1500);
    expect(Math.abs((await y(smooth.p)) - (bottom - 300))).toBeLessThan(2);
    // an anchor-style jump is the browser's too
    await smooth.p.evaluate(() => window.scrollTo(0, 100));
    await smooth.p.waitForTimeout(800);
    expect(Math.abs((await y(smooth.p)) - 100)).toBeLessThan(2);
    await smooth.ctx.close();

    const reduced = await open(true);
    expect(await reduced.p.evaluate(() => document.querySelectorAll("script[src*='lazylayout-smooth']").length)).toBe(1); // it is there...
    await reduced.p.mouse.wheel(0, 600);
    await reduced.p.waitForTimeout(1200);
    expect(Math.abs((await y(reduced.p)) - 600), "...but does nothing: the page scrolls as the browser does").toBeLessThan(2);
    await reduced.ctx.close();
  });
});
