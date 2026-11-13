/**
 * Design track D8: the Repeater. A layer repeated N times with steps; the copies are drawn, not selectable, and shipped.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function setup(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.1, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.18, b.y + b.height * 0.4, { steps: 4 });
  await page.mouse.up();
  return Object.values(await layers(page)).find((l) => !before.has(l.id))!;
}
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const exported = (page: Page) =>
  page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    const out = await w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    return out.files.map((f) => f.text ?? "").join("\n");
  });

test.describe("Repeater (D8)", () => {
  test("a layer repeated 5 times with a step: 4 copies, each stepped, none selectable, all exported", async ({ page }) => {
    const r = await setup(page);
    const original = page.locator(`[data-testid="stage-page"] > [data-archetype][data-element-id="${r.id}"], [data-testid="stage-page"] [data-archetype][data-element-id="${r.id}"]`).first();
    const x0 = (await original.boundingBox())!.x;
    const w0 = (await original.boundingBox())!.width;

    await set(page, "Repeat count", 5);
    await set(page, "Repeat step X", 120);
    const copies = page.locator('[data-testid="stage-page"] [data-repeat-copy]');
    await expect(copies).toHaveCount(4);
    // the page's own scale: a copy i sits i * 120 page px right; compare against the original's width ratio
    const pageEl = page.locator('[data-testid="stage-page"]');
    const k = (await pageEl.boundingBox())!.width / (await pageEl.evaluate((e) => (e as HTMLElement).offsetWidth));
    for (let i = 1; i <= 4; i++) {
      const box = (await page.locator(`[data-repeat-copy="${i}"] [data-archetype]`).first().boundingBox())!;
      expect(Math.abs(box.x - (x0 + i * 120 * k))).toBeLessThan(1.5);
      expect(Math.abs(box.width - w0)).toBeLessThan(1.5);
    }
    // the original is still the one layer: one in the document, and the copies carry no layer of their own
    expect(Object.keys(await layers(page)).filter((id) => id === r.id)).toHaveLength(1);
    expect((await layers(page))[r.id].properties["repeat.count"]).toBe(5);

    // the export ships the copies (5 boxes) and none of the editor's marks
    const html = await exported(page);
    expect(html).not.toContain("data-repeat-copy");
    await set(page, "Repeat count", 1);
    await expect(copies).toHaveCount(0);
    const single = await exported(page);
    // each copy is a wrapper div and one more of the layer (a rectangle exports as an inline svg)
    expect((html.match(/<div/g) ?? []).length - (single.match(/<div/g) ?? []).length).toBe(4);
    expect((html.match(/<svg/g) ?? []).length - (single.match(/<svg/g) ?? []).length).toBe(4);
    // and the steps ship: copy 3 is 360 px along
    expect(html).toMatch(/translate\(360px,\s*0px\)/);
    expect(single).not.toMatch(/translate\(360px/);
  });

  test("rotation, scale and fade steps are drawn", async ({ page }) => {
    await setup(page);
    await set(page, "Repeat count", 3);
    await set(page, "Repeat rotate step", 30);
    await set(page, "Repeat scale step", 0.5);
    await set(page, "Repeat opacity step", 0.5);
    const c1 = page.locator('[data-repeat-copy="1"]');
    const c2 = page.locator('[data-repeat-copy="2"]');
    await expect(c1).toHaveCount(1);
    expect(await c1.evaluate((e) => getComputedStyle(e).opacity)).toBe("0.5");
    expect(await c2.evaluate((e) => getComputedStyle(e).opacity)).toBe("0.25");
    expect(await c2.evaluate((e) => (e as HTMLElement).style.transform)).toContain("rotate(60deg)");
    expect(await c2.evaluate((e) => (e as HTMLElement).style.transform)).toContain("scale(0.25)");
  });

  test("one undo step takes the copies away", async ({ page }) => {
    await setup(page);
    await set(page, "Repeat count", 4);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(3);
    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(0);
  });
});
