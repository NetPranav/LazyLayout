/**
 * Design track D18: speed effects. A swinging layer stretches along its motion by how fast it moves, leans, blurs and leaves an
 * echo trail; at rest it is left alone.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function swinging(page: Page) {
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
  const before = new Set(Object.keys(await layers(page)));
  await pickShape(page, "Rectangle");
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.4, { steps: 4 });
  await page.mouse.up();
  const id = Object.values(await layers(page)).find((l) => !before.has(l.id))!.id;
  // it swings: x = 300 sin(2t), so its speed is 600 cos(2t)
  await page.getByLabel("Expression property", { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("option", { name: /^Position X/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByLabel("Expression text", { exact: true }).fill("300 * sin(time * 2)");
  await page.getByRole("button", { name: "Set expression", exact: true }).click();
  await expect(page.locator("[data-expression-slot]")).toContainText("sin(time * 2)");
  return id;
}
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const motion = async (page: Page) => {
  await page.getByText("Motion", { exact: true }).first().click();
  await page.waitForFunction(() => !!(window as unknown as { __LL_ENGINE__?: unknown }).__LL_ENGINE__);
};
const seek = (page: Page, t: number) => page.evaluate((x) => (window as unknown as { __LL_ENGINE__: { seek: (t: number) => void } }).__LL_ENGINE__.seek(x), t);
const written = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first().evaluate((e) => (e as HTMLElement).style.transform);
const lastScale = (t: string): [number, number] | null => {
  const m = [...t.matchAll(/scale\(([\d.]+), ([\d.]+)\)/g)].pop();
  return m ? [Number(m[1]), Number(m[2])] : null;
};

test.describe("Speed effects (D18)", () => {
  test("the layer stretches by its speed at five times, and is left alone at the turn", async ({ page }) => {
    const id = await swinging(page);
    await set(page, "Speed stretch", 1);
    await set(page, "Speed reference", 1000);
    await motion(page);
    for (const t of [0, 0.5, 1.0, 1.5, 2.2]) {
      await seek(page, t);
      const along = 1 + Math.min(1, Math.abs(600 * Math.cos(2 * t)) / 1000);
      await expect.poll(async () => lastScale(await written(page, id))?.[0] ?? 1, { message: `t = ${t}` }).toBeGreaterThan(along - 0.02);
      expect(lastScale(await written(page, id))![0]).toBeLessThan(along + 0.02);
    }
    await seek(page, Math.PI / 4); // the turning point: speed 0
    await expect.poll(async () => lastScale(await written(page, id))).toBeNull();
  });

  test("lean and blur follow the speed too, and Design shows the plain layer", async ({ page }) => {
    const id = await swinging(page);
    await set(page, "Speed lean", 20);
    await set(page, "Speed blur", 0.02);
    await motion(page);
    await seek(page, 0);
    // 20 degrees x (600 px/s / 1200 px/s reference) = 10
    await expect.poll(async () => Number(/rotate\(([\d.]+)deg\)\s*$/.exec(await written(page, id))?.[1] ?? "0")).toBeGreaterThan(9.9);
    expect(Number(/rotate\(([\d.]+)deg\)\s*$/.exec(await written(page, id))![1])).toBeLessThan(10.1);
    const filter = await page.locator(`[data-testid="stage-page"] [data-element-id="${id}"]`).first().evaluate((e) => (e as HTMLElement).style.filter);
    expect(filter).toMatch(/url\(\"?#mb-/); // the blur filter
    await page.getByText("Design", { exact: true }).first().click();
    await expect.poll(async () => (await written(page, id)).includes("scale(")).toBe(false);
  });

  test("a trail: echoes run behind the layer, each a little later", async ({ page }) => {
    const id = await swinging(page);
    await set(page, "Trail copies", 3);
    await set(page, "Trail gap", 0.1);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(3);
    await motion(page);
    await seek(page, 1);
    const x = (sel: string) => page.locator(sel).first().evaluate((e) => new DOMMatrix(getComputedStyle(e).transform).e);
    const copy = (i: number) => `[data-repeat-copy="${i}"] [data-element-id="${id}"]`;
    // at t = 1 the layer is at 300 sin(2); copy i is at 300 sin(2 (1 - 0.1 i)): each one back along its path
    for (const i of [1, 2, 3]) {
      const want = 300 * Math.sin(2 * (1 - 0.1 * i));
      await expect.poll(async () => Math.abs((await x(copy(i))) - want)).toBeLessThan(1.5);
    }
    await page.getByText("Design", { exact: true }).first().click();
    await page.getByRole("button", { name: "Remove trail", exact: true }).click();
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(0);
  });
});
