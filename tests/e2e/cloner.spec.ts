/**
 * Design track D9: the Cloner. A dot copied as a grid, a ring, or filling the area; drawn by the renderer, so the editor and
 * the export agree.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function dot(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Ellipse");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.12, b.y + b.height * 0.24, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const mode = async (page: Page, name: string) => {
  await page.getByLabel("Clone mode", { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(500);
};
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const exported = (page: Page) =>
  page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const out = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return out.files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
const geom = (page: Page, id: string) => layers(page).then((l) => ({ x: Number(l[id].properties["frame.x"]), y: Number(l[id].properties["frame.y"]), w: Number(l[id].properties["frame.width"]), h: Number(l[id].properties["frame.height"]) }));

test.describe("Cloner (D9)", () => {
  test("grid: 4 columns by 3 rows of a dot, 11 copies at the pitch", async ({ page }) => {
    const d = await dot(page);
    const g = await geom(page, d.id);
    await mode(page, "Grid");
    await set(page, "Clone columns", 4);
    await set(page, "Clone rows", 3);
    await set(page, "Clone gap X", 20);
    await set(page, "Clone gap Y", 30);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(11);
    const pageEl = page.locator('[data-testid="stage-page"]');
    const k = (await pageEl.boundingBox())!.width / (await pageEl.evaluate((e) => (e as HTMLElement).offsetWidth));
    const o = (await page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${d.id}"]`).first().boundingBox())!;
    // copy 5 is the second row, first column (copies run row by row; the layer is cell 0): offset (0, 1 pitch)
    const c5 = (await page.locator('[data-repeat-copy="4"] [data-archetype]').first().boundingBox())!;
    expect(Math.abs(c5.x - o.x)).toBeLessThan(1.5);
    expect(Math.abs(c5.y - (o.y + (g.h + 30) * k))).toBeLessThan(1.5);
  });

  test("fill area: the dot fills its frame, and the panel says how many", async ({ page }) => {
    const d = await dot(page);
    await mode(page, "Fill area");
    await set(page, "Clone gap X", 40);
    await set(page, "Clone gap Y", 40);
    const note = await page.getByRole("status", { name: "Clone count" }).textContent();
    const total = Number(/(\d+) in all/.exec(note ?? "")?.[1]);
    expect(total).toBeGreaterThan(50);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(total - 1);
    // every copy is inside the frame the dot sits in (or crosses its edge): none is far outside it
    const pageBox = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    for (const box of await page.locator("[data-repeat-copy] [data-archetype]").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      expect(box.right).toBeGreaterThan(pageBox.x - 1);
      expect(box.left).toBeLessThan(pageBox.x + pageBox.width + 1);
      expect(box.bottom).toBeGreaterThan(pageBox.y - 1);
      expect(box.top).toBeLessThan(pageBox.y + pageBox.height + 1);
    }
    expect(d.id).toBeTruthy();
  });

  test("ring: 6 copies around a circle, turned to face out", async ({ page }) => {
    const d = await dot(page);
    await mode(page, "Ring");
    await set(page, "Clone count", 6);
    await set(page, "Clone radius", 120);
    await page.getByRole("button", { name: "Clone face out", exact: true }).click();
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(5);
    expect(await page.locator('[data-repeat-copy="3"]').evaluate((e) => (e as HTMLElement).style.transform)).toContain("rotate(180deg)");
    expect(d.id).toBeTruthy();
  });

  test("a 100 x 60 dot grid exports with no script, and has the same copies as the editor", async ({ page }) => {
    test.setTimeout(180_000);
    await dot(page);
    await mode(page, "Grid");
    await set(page, "Clone columns", 100);
    await set(page, "Clone rows", 60);
    await set(page, "Clone gap X", 4);
    await set(page, "Clone gap Y", 4);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(5999, { timeout: 60_000 });
    const files = await exported(page);
    const html = files.filter((f) => f.path.endsWith(".html")).map((f) => f.text).join("\n");
    expect(html).not.toMatch(/<script/i);
    expect(files.some((f) => f.path.endsWith(".js"))).toBe(false);
    expect(html).not.toContain("data-repeat-copy");
    expect((html.match(/aria-hidden="true"/g) ?? []).length).toBe(5999);
  });
});
