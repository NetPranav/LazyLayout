/**
 * ROADMAP Phase 51 gate, in a real browser: File > Insert Section opens a gallery of eight templates; six of them
 * make a landing page without any layer being placed by hand; every section stays inside the page; switching the
 * document to Dark restyles all of it on the real renderer; and a starter project adds linked pages.
 */
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { diffPixels, openEditor, openFileMenu } from "./support/editor";

type Reg = { all: () => { id: string; run: (a?: unknown) => unknown }[] };
type Doc = { get: () => { layers: Record<string, { id: string; name: string; parentId: string | null; children: string[]; section?: unknown; page?: { route: string }; link?: unknown }> } };

const run = (page: Page, id: string, args?: unknown) =>
  page.evaluate(({ id, args }) => (window as unknown as { __LL_COMMANDS__: Reg }).__LL_COMMANDS__.all().find((c) => c.id === id)!.run(args), { id, args });
const layers = (page: Page) => page.evaluate(() => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers);

async function openGallery(page: Page) {
  await openFileMenu(page);
  await page.getByRole("menuitem", { name: /Insert Section/ }).click();
  return page.getByRole("dialog", { name: "Insert section" });
}

/** The screen size of the frame a page is drawn in. */
const frameRect = (page: Page, pageId: string) =>
  page.evaluate((id) => {
    const f = Array.from(document.querySelectorAll("iframe")).find((i) => i.contentDocument?.querySelector(`[data-element-id="${id}"]`));
    const r = f?.getBoundingClientRect();
    return { w: r?.width ?? 0, h: r?.height ?? 0 };
  }, pageId);
const frameWidth = async (page: Page, pageId: string) => (await frameRect(page, pageId)).w;

/** Zooms to a page and waits until the zoom has settled (two equal readings, and not the sliver a not-yet-sized canvas gives). */
async function fitPage(page: Page, pageId: string) {
  await run(page, "selection.set", { ids: [pageId] });
  let last = -1;
  await expect(async () => {
    await run(page, "canvas.zoomToSelection");
    await page.waitForTimeout(300);
    const w = await frameWidth(page, pageId);
    const settled = Math.abs(w - last) < 0.5;
    last = w;
    expect(w, "the page is drawn at a size you can see").toBeGreaterThan(100);
    expect(settled, "the zoom has settled").toBe(true);
  }).toPass({ timeout: 20_000 });
  await page.waitForTimeout(600);
}

test("Phase 51: six templates make a landing page that follows the theme", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const gallery = await openGallery(page);
  await expect(gallery.getByRole("button", { name: /^Insert / })).toHaveCount(8);
  for (const name of ["Navbar", "Hero", "Features", "Pricing", "FAQ", "Footer"]) await gallery.getByRole("button", { name: `Insert ${name}` }).click();
  await page.keyboard.press("Escape");
  await gallery.getByRole("button", { name: "Close" }).click();

  const all = await layers(page);
  const pageLayer = Object.values(all).find((l) => l.page);
  expect(pageLayer, "a page was made").toBeTruthy();
  const sections = pageLayer!.children.map((id) => all[id]).filter((l) => l.section);
  expect(sections.map((s) => s.name)).toEqual(["Navbar", "Hero", "Features", "Pricing", "FAQ", "Footer"]);
  expect(Object.keys(all).length, "dozens of real layers, none placed by hand").toBeGreaterThan(80);

  await fitPage(page, pageLayer!.id);
  const light = await page.locator(".dock-zone--center").first().screenshot();
  writeFileSync(testInfo.outputPath("landing-light.png"), light);
  await testInfo.attach("landing-light", { body: light, contentType: "image/png" });

  // every section stays inside the page, and the text is really there
  const fit = await page.evaluate(
    ({ ids }) => {
      const frame = Array.from(document.querySelectorAll("iframe")).find((i) => i.contentDocument?.querySelector(`[data-element-id="${ids.page}"]`))!;
      const doc = frame.contentDocument!;
      const root = doc.querySelector<HTMLElement>(`[data-element-id="${ids.page}"]`)!;
      const pageBox = root.getBoundingClientRect();
      return ids.sections.map((id: string) => {
        const el = doc.querySelector<HTMLElement>(`[data-element-id="${id}"]`);
        const b = el?.getBoundingClientRect();
        return { id, found: !!el, over: b ? Math.max(0, b.right - pageBox.right, pageBox.left - b.left, b.bottom - pageBox.bottom) : -1, height: b?.height ?? 0 };
      });
    },
    { ids: { page: pageLayer!.id, sections: sections.map((s) => s.id) } },
  );
  for (const f of fit) {
    expect(f.found, `${f.id} is drawn`).toBe(true);
    expect(f.over, `${f.id} stays inside the page, sideways and down`).toBeLessThanOrEqual(1);
    expect(f.height, `${f.id} has height`).toBeGreaterThan(20);
  }

  // a close look at each section, kept with the run
  for (const sec of sections) {
    await run(page, "selection.set", { ids: [sec.id] });
    await expect(async () => {
      await run(page, "canvas.zoomToSelection");
      await page.waitForTimeout(300);
      expect(await frameWidth(page, pageLayer!.id)).toBeGreaterThan(400);
    }).toPass({ timeout: 15_000 });
    await page.waitForTimeout(400);
    const shot = await page.locator(".dock-zone--center").first().screenshot();
    writeFileSync(testInfo.outputPath(`section-${sec.name.replace(/\W+/g, "-")}.png`), shot);
    await testInfo.attach(`section-${sec.name}`, { body: shot, contentType: "image/png" });
  }
  await fitPage(page, pageLayer!.id);

  // Dark restyles all of it
  await run(page, "token.setMode", { id: "dark" });
  await page.waitForTimeout(800);
  const dark = await page.locator(".dock-zone--center").first().screenshot();
  writeFileSync(testInfo.outputPath("landing-dark.png"), dark);
  await testInfo.attach("landing-dark", { body: dark, contentType: "image/png" });
  const d = diffPixels(light, dark, testInfo.outputPath("light-vs-dark.png"));
  const shown = await frameRect(page, pageLayer!.id);
  expect(d.n, "Dark changes most of the page").toBeGreaterThan(0.4 * shown.w * shown.h);
  expect(shown.h, "the page is drawn as tall as its sections, not clipped at 900").toBeGreaterThan(shown.w * 1.2);
  await run(page, "token.setMode", { id: null });
});

test("Phase 51: a starter project adds linked pages in one step", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const gallery = await openGallery(page);
  await gallery.getByRole("button", { name: "Add Portfolio" }).click();
  await expect(gallery.getByText(/Added the Portfolio pages/)).toBeVisible();
  const all = await layers(page);
  const pages = Object.values(all).filter((l) => l.page);
  expect(pages.map((p) => p.page!.route).sort()).toEqual(["/", "/about"]);
  expect(Object.values(all).filter((l) => l.link).length, "navigation text is linked").toBeGreaterThanOrEqual(6);
});
