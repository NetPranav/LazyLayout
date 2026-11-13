/**
 * Design track D10: effectors vary the copies of a Repeat or Clone: a ramp, noise, or the pointer's distance.
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
const choose = async (page: Page, label: string, name: string) => {
  await page.getByLabel(label, { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).first().click();
  await page.waitForTimeout(500);
};
const set = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const copyBox = (page: Page, i: number) => page.locator(`[data-repeat-copy="${i}"] [data-archetype]`).first().boundingBox();

test.describe("Effectors (D10)", () => {
  test("a ramp grows each copy a little more than the last", async ({ page }) => {
    const d = await dot(page);
    await set(page, "Repeat count", 5);
    await set(page, "Repeat step X", 60);
    await choose(page, "Effector mode", "Ramp");
    await set(page, "Effector scale", 3);
    await expect(page.locator("[data-repeat-copy]")).toHaveCount(4);
    // copy i of 5 has influence i/4, so its size is 1 + 2*i/4 times the layer's: 1.5, 2, 2.5, 3
    const orig = (await page.locator(`[data-testid="stage-page"] [data-element-id="${d.id}"]`).first().boundingBox())!;
    for (let i = 1; i <= 4; i++) {
      const b = (await copyBox(page, i))!;
      expect(Math.abs(b.width / orig.width - (1 + (2 * i) / 4))).toBeLessThan(0.06);
    }
  });

  test("noise varies the copies, the same every time", async ({ page }) => {
    await dot(page);
    await set(page, "Repeat count", 8);
    await set(page, "Repeat step X", 50);
    await choose(page, "Effector mode", "Noise");
    await set(page, "Effector scale", 2.5);
    const widths = async () => Promise.all(Array.from({ length: 7 }, async (_, i) => Math.round((await copyBox(page, i + 1))!.width)));
    const a = await widths();
    expect(Math.max(...a) - Math.min(...a)).toBeGreaterThan(3);
    expect(await widths()).toEqual(a); // drawn again, the same (the same seed gives the same widths: also checked in the unit tests)
  });

  test("dots grow near the pointer in Motion, and go back when it leaves", async ({ page }) => {
    await dot(page);
    await choose(page, "Clone mode", "Fill area");
    await set(page, "Clone gap X", 60);
    await set(page, "Clone gap Y", 60);
    await choose(page, "Effector mode", "Pointer");
    await set(page, "Effector scale", 3);
    await set(page, "Effector radius", 200);
    const copies = page.locator("[data-repeat-copy]");
    const n = await copies.count();
    expect(n).toBeGreaterThan(50);
    const widths = () => copies.evaluateAll((els) => els.map((e) => (e.querySelector("[data-archetype]") as HTMLElement).getBoundingClientRect().width));
    const designed = await widths();
    expect(Math.max(...designed) - Math.min(...designed)).toBeLessThan(1); // as drawn: all alike

    await page.getByText("Motion", { exact: true }).first().click();
    const page0 = (await page.locator('[data-testid="stage-page"]').boundingBox())!;
    await page.mouse.move(page0.x + page0.width * 0.5, page0.y + page0.height * 0.5, { steps: 6 });
    await page.waitForTimeout(400);
    const near = await widths();
    expect(Math.max(...near)).toBeGreaterThan(Math.min(...near) * 2); // the dots under the pointer grew, the far ones did not
    // the biggest dot is the one nearest the pointer
    const boxes = await copies.evaluateAll((els) => els.map((e) => { const r = (e.querySelector("[data-archetype]") as HTMLElement).getBoundingClientRect(); return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width }; }));
    const biggest = boxes.reduce((a, b) => (b.w > a.w ? b : a));
    const nearest = boxes.reduce((a, b) => (Math.hypot(b.cx - (page0.x + page0.width / 2), b.cy - (page0.y + page0.height / 2)) < Math.hypot(a.cx - (page0.x + page0.width / 2), a.cy - (page0.y + page0.height / 2)) ? b : a));
    expect(Math.hypot(biggest.cx - nearest.cx, biggest.cy - nearest.cy)).toBeLessThan(120 * 0.5); // within the grid pitch

    // back in Design the copies are as drawn
    await page.getByText("Design", { exact: true }).first().click();
    await expect.poll(async () => { const w = await widths(); return Math.max(...w) - Math.min(...w); }).toBeLessThan(1);
  });
});
