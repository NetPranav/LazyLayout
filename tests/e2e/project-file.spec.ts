/**
 * Design track D24: save a project file and open it in a fresh browser from the new editor's File menu. The file opens
 * identically (document, pictures); a file from a newer version, or one that is not a project, is refused in words.
 */
import { test, expect, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { canonical, exportProject, openEditor, openFileMenu, pickShape } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function importFile(page: Page, path: string) {
  await openFileMenu(page);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("menuitem", { name: "Import project file…" }).click()]);
  await chooser.setFiles(path);
}

test.describe("Project file (D24)", () => {
  let savedPath = "";
  let saved: { snapshot: { document: unknown } };

  test("save, then open in a fresh browser: the document is identical, with its picture", async ({ page, browser }, testInfo) => {
    await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(page);
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    await page.evaluate((src) => {
      const d = (window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, { name: string }> }; commands: { addLayer: (a: unknown) => string } } }).__LL_DOC__;
      const hero = Object.values(d.get().layers).find((l) => l.name === "Hero") as unknown as { id: string };
      d.commands.addLayer({ archetype: "image", parentId: hero.id, name: "Pic", properties: { positioning: "absolute", "frame.x": 5, "frame.y": 5, "frame.width": 50, "frame.height": 50, "media.src": src } });
    }, PNG);
    await pickShape(page, "Rectangle");
    const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await page.mouse.move(b.x + 40, b.y + 40);
    await page.mouse.down();
    await page.mouse.move(b.x + 120, b.y + 100, { steps: 4 });
    await page.mouse.up();
    const out = testInfo.outputPath();
    const first = await exportProject(page, out, "saved");
    savedPath = first.path;
    saved = first.file;

    // a fresh browser context: empty storage
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    const fresh = await ctx.newPage();
    await fresh.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
    await openEditor(fresh);
    await importFile(fresh, savedPath);
    await fresh.waitForFunction((u) => location.href !== u, fresh.url());
    await expect(fresh.locator("[data-stage=artboard]")).toBeVisible();
    await fresh.waitForTimeout(800);
    const again = await exportProject(fresh, out, "reopened");
    expect(canonical(again.file.snapshot.document), "the document is identical").toBe(canonical(saved.snapshot.document));
    await ctx.close();
  });

  test("a file from a newer version is refused with a clear message, and nothing changes", async ({ page }, testInfo) => {
    test.skip(!savedPath, "needs the saved file");
    const newer = { ...JSON.parse(JSON.stringify(saved)), formatVersion: 999 };
    const p = testInfo.outputPath("newer.lazy.json");
    writeFileSync(p, JSON.stringify(newer));
    await openEditor(page);
    const before = page.url();
    await importFile(page, p);
    await expect(page.getByRole("status").getByText(/newer than this version of LazyLayout/)).toBeVisible({ timeout: 8000 });
    expect(page.url()).toBe(before);
  });

  test("a file that is not a project is refused in words", async ({ page }, testInfo) => {
    const p = testInfo.outputPath("junk.lazy.json");
    writeFileSync(p, "{ not json");
    await openEditor(page);
    await importFile(page, p);
    await expect(page.getByRole("status").getByText(/not valid JSON/)).toBeVisible({ timeout: 8000 });
  });
});
