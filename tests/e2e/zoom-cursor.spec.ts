/**
 * Zoom steps (Cmd/Ctrl + / -) and Ctrl/Cmd + wheel zoom around the mouse instead of jumping the page to the middle of the
 * canvas, and the canvas cursor stays drawn over the canvas's own right-click menu.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

test.use({ viewport: { width: 1600, height: 1000 } });

const board = async (page: Page) => (await page.locator("[data-stage=artboard]").boundingBox())!;
/** Where `p` falls on the page, as a fraction of its width and height. */
const fractionAt = async (page: Page, p: { x: number; y: number }) => {
  const b = await board(page);
  return { fx: (p.x - b.x) / b.width, fy: (p.y - b.y) / b.height, width: b.width };
};

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
}

/** Pans the page off centre with a plain wheel, so a zoom that re-centres would show. */
async function panOffCentre(page: Page) {
  const view = (await page.getByTestId("stage-viewport").boundingBox())!;
  await page.mouse.move(view.x + view.width / 2, view.y + view.height / 2);
  const before = await board(page);
  await page.mouse.wheel(120, 90);
  await expect.poll(async () => Math.round((await board(page)).x - before.x)).toBe(-120);
}

test.describe("zoom around the mouse", () => {
  test("Cmd/Ctrl + and - keep the page point under the mouse in place", async ({ page }) => {
    await ready(page);
    await panOffCentre(page);
    const b = await board(page);
    const p = { x: b.x + b.width * 0.2, y: b.y + b.height * 0.25 };
    await page.mouse.move(p.x, p.y);
    const start = await fractionAt(page, p);

    await page.keyboard.press("ControlOrMeta+Equal");
    await expect.poll(async () => (await board(page)).width).toBeGreaterThan(start.width * 1.05);
    let now = await fractionAt(page, p);
    expect(Math.abs(now.fx - start.fx)).toBeLessThan(0.005);
    expect(Math.abs(now.fy - start.fy)).toBeLessThan(0.005);

    // two quick steps in a row still hold the point
    await page.keyboard.press("ControlOrMeta+Equal");
    await page.keyboard.press("ControlOrMeta+Equal");
    await expect.poll(async () => (await board(page)).width).toBeGreaterThan(now.width * 1.1);
    now = await fractionAt(page, p);
    expect(Math.abs(now.fx - start.fx)).toBeLessThan(0.005);
    expect(Math.abs(now.fy - start.fy)).toBeLessThan(0.005);

    const wide = now.width;
    await page.keyboard.press("ControlOrMeta+Minus");
    await expect.poll(async () => (await board(page)).width).toBeLessThan(wide * 0.95);
    now = await fractionAt(page, p);
    expect(Math.abs(now.fx - start.fx)).toBeLessThan(0.005);
    expect(Math.abs(now.fy - start.fy)).toBeLessThan(0.005);
  });

  test("Ctrl/Cmd + wheel zooms around the mouse too", async ({ page }) => {
    await ready(page);
    await panOffCentre(page);
    const b = await board(page);
    const p = { x: b.x + b.width * 0.75, y: b.y + b.height * 0.3 };
    await page.mouse.move(p.x, p.y);
    const start = await fractionAt(page, p);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -40);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await board(page)).width).toBeGreaterThan(start.width * 1.05);
    const now = await fractionAt(page, p);
    expect(Math.abs(now.fx - start.fx)).toBeLessThan(0.005);
    expect(Math.abs(now.fy - start.fy)).toBeLessThan(0.005);
  });
});

test("the canvas cursor stays drawn over the canvas's right-click menu", async ({ page }) => {
  await ready(page);
  const view = (await page.getByTestId("stage-viewport").boundingBox())!;
  const spot = { x: view.x + 60, y: view.y + view.height - 160 }; // blank canvas beside the page
  await page.mouse.move(spot.x, spot.y);
  await expect(page.locator("#ll-cur")).toHaveClass(/\bon\b/);
  await page.mouse.click(spot.x, spot.y, { button: "right" });
  const item = page.getByRole("menuitem").first();
  await expect(item).toBeVisible();
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
  await expect(page.locator("#ll-cur")).toHaveClass(/\bon\b/);
  await expect(page.locator("html")).toHaveClass(/\bll-cur-menu\b/);
  expect(await item.evaluate((el) => getComputedStyle(el).cursor)).toBe("none");

  // closing the menu leaves no hidden system cursor behind
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem")).toHaveCount(0);
  await page.mouse.move(view.x + 60, view.y + view.height - 150);
  await expect(page.locator("html")).not.toHaveClass(/\bll-cur-menu\b/);
});
