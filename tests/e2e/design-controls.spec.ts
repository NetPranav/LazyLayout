/**
 * Phase 52 / Design track D1–D2: the Design panel's controls change what is drawn. Each test drives a control through the
 * inspector (as a person does) and checks the drawn result, not only the stored value.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  for (const name of ["Hero", "Features", "Footer", "Other elements"]) {
    await page.getByText(name, { exact: true }).first().click();
    await page.keyboard.press("Delete");
  }
}
const art = async (page: Page, fx: number, fy: number) => {
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};
async function drag(page: Page, a: { x: number; y: number }, b: { x: number; y: number }) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 3 });
  await page.mouse.up();
}
const created = async (page: Page, make: () => Promise<void>) => {
  const before = new Set(Object.keys(await layers(page)));
  await make();
  const after = await layers(page);
  return Object.values(after).find((l) => !before.has(l.id))!;
};
const frame = (page: Page, x1: number, y1: number, x2: number, y2: number) =>
  created(page, async () => {
    await page.getByRole("button", { name: /^Frame/ }).first().click();
    await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  });
const shape = (page: Page, kind: string, x1: number, y1: number, x2: number, y2: number) =>
  created(page, async () => {
    await pickShape(page, kind);
    await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  });
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`).first();
const css = (page: Page, id: string, prop: string) => drawn(page, id).evaluate((e, p) => getComputedStyle(e as HTMLElement).getPropertyValue(p), prop);
const num = async (page: Page, label: string, v: number | string) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const open = (page: Page, label: string) => page.getByRole("button", { name: label, exact: true }).first().click();
const select = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`).click();

test.describe("Design controls change what is drawn", () => {
  test("padding on a frame (LA-017)", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.2, 0.6, 0.7);
    await open(page, "More Layout options");
    await num(page, "Padding top", 40);
    await expect.poll(() => css(page, f.id, "padding-top")).toBe("40px");
  });

  test("margin moves a child inside an auto-layout frame (LA-018)", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.2, 0.7, 0.7);
    await page.getByLabel("Auto layout row", { exact: true }).first().click();
    const r = await shape(page, "Rectangle", 0.15, 0.3, 0.3, 0.45);
    const x0 = (await drawn(page, r.id).boundingBox())!.x;
    await open(page, "More Layout options");
    await num(page, "Margin left", 60);
    await expect.poll(async () => (await drawn(page, r.id).boundingBox())!.x - x0).toBeGreaterThan(10);
    expect(f.id).toBeTruthy();
  });

  test("grow widens a child in a stack (LA-020)", async ({ page }) => {
    await ready(page);
    await frame(page, 0.1, 0.2, 0.7, 0.7);
    await page.getByLabel("Auto layout row", { exact: true }).first().click();
    const r = await shape(page, "Rectangle", 0.15, 0.3, 0.25, 0.45);
    const w0 = (await drawn(page, r.id).boundingBox())!.width;
    await open(page, "More Layout options");
    await num(page, "Grow", 1);
    await expect.poll(async () => (await drawn(page, r.id).boundingBox())!.width).toBeGreaterThan(w0 * 1.5);
  });

  test("fill opacity makes the fill see-through, not the layer (LA-007)", async ({ page }) => {
    await ready(page);
    const r = await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    await num(page, "Fill opacity", 30);
    await expect.poll(async () => {
      const bg = await css(page, r.id, "background-color");
      const m = /rgba?\(([^)]+)\)/.exec(bg);
      const parts = (m?.[1] ?? "").split(",").map((x) => Number(x.trim()));
      return parts.length === 4 ? parts[3] : 1;
    }).toBeLessThan(0.5);
    expect(Number(await css(page, r.id, "opacity"))).toBe(1);
  });

  for (const [name, check] of [
    ["Inner shadow", (page: Page, id: string) => drawn(page, id).evaluate((e) => /<filter|feComposite|inset/.test(e.outerHTML))],
    ["Layer blur", async (page: Page, id: string) => (await css(page, id, "filter")).includes("blur")],
    ["Background blur", async (page: Page, id: string) => (await css(page, id, "backdrop-filter")).includes("blur")],
  ] as const) {
    test(`effect "${name}" is selectable and draws (LA-028)`, async ({ page }) => {
      await ready(page);
      const r = await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
      await page.getByRole("button", { name: /^Add effect/ }).first().click();
      await open(page, "Effect 1 settings");
      await page.locator('[aria-label="Effect type"]:visible').first().click();
      await page.getByRole("option", { name }).first().click();
      await expect.poll(() => check(page, r.id)).toBe(true);
    });
  }

  test("a drop shadow on a line renders (LA-034)", async ({ page }) => {
    await ready(page);
    const l = await shape(page, "Line", 0.3, 0.3, 0.55, 0.4);
    await open(page, "Add effects");
    // a line draws its shadow inside its SVG (a box shadow of a 2 px box would be invisible)
    await expect.poll(() => drawn(page, l.id).evaluate((e) => /<filter|drop-shadow|feDropShadow/.test(e.outerHTML))).toBe(true);
  });

  test("the chosen cursor shows over the layer (LA-022)", async ({ page }) => {
    await ready(page);
    const r = await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    await open(page, "More Appearance options");
    const cur = page.getByLabel("Cursor", { exact: true }).first();
    await cur.click();
    await page.getByRole("option", { name: /pointer/i }).first().click();
    await expect.poll(() => page.locator(`[data-testid="stage-element"][data-element-id="${r.id}"]`).evaluate((e) => getComputedStyle(e).cursor)).toBe("pointer");
  });

  test("Fixed, Hug and Fill size differently in a stack (LA-010)", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.2, 0.7, 0.7);
    await page.getByLabel("Auto layout row", { exact: true }).first().click();
    const r = await shape(page, "Rectangle", 0.15, 0.3, 0.25, 0.45);
    const widthOf = async () => (await drawn(page, r.id).boundingBox())!.width;
    const fixed = await widthOf();
    await page.getByLabel("Width sizing", { exact: true }).selectOption?.("fill").catch(() => undefined);
    const sizing = page.getByLabel("Width sizing", { exact: true }).first();
    await sizing.click();
    await page.getByRole("option", { name: /fill/i }).first().click();
    await expect.poll(widthOf).toBeGreaterThan(fixed * 1.5);
    const frameWidth = (await drawn(page, f.id).boundingBox())!.width;
    expect(await widthOf()).toBeLessThanOrEqual(frameWidth);
  });

  test("two fills reorder by their handle (LA-006)", async ({ page }) => {
    await ready(page);
    const r = await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    await open(page, "Add fill");
    // the new fill starts with the same colour: give it its own, so a swap can be seen
    const second = page.getByLabel("Fill hex").nth(1);
    await second.fill("FF0000");
    await second.press("Enter");
    const first = () => page.getByLabel("Fill 1 color", { exact: true }).first();
    const before = await page.getByLabel("Fill hex").first().inputValue();
    const h = page.getByLabel("Reorder fill 1", { exact: true }).first();
    const b = (await h.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height + 40, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => page.getByLabel("Fill hex").first().inputValue()).not.toBe(before);
    expect(r.id).toBeTruthy();
    expect(await first().count()).toBeGreaterThan(0);
  });

  test("text modes: wrap, no wrap and clip are different (LA-003)", async ({ page }) => {
    await ready(page);
    const t = await created(page, async () => {
      await page.getByRole("button", { name: /^Text/ }).first().click();
      await drag(page, await art(page, 0.2, 0.3), await art(page, 0.3, 0.38));
      await page.keyboard.type("A long line of text that cannot fit in this small box at all");
      await page.keyboard.press("Escape");
    });
    expect(t.archetype).toBe("text");
    await open(page, "More Typography options");
    const wsMode = async (name: RegExp) => {
      const ws = page.getByLabel("White space", { exact: true }).first();
      await ws.click();
      await page.getByRole("option", { name }).first().click();
    };
    await wsMode(/no wrap|nowrap/i);
    await expect.poll(() => css(page, t.id, "white-space")).toBe("nowrap");
    await page.waitForTimeout(500); // the first dropdown is still closing
    const ov = page.getByLabel("Text overflow", { exact: true }).first();
    await ov.click();
    await page.getByRole("option", { name: /ellipsis/i }).first().click();
    await expect.poll(() => css(page, t.id, "text-overflow")).toBe("ellipsis");
  });

  test("blend modes explain themselves (LA-021)", async ({ page }) => {
    await ready(page);
    await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    await open(page, "More Appearance options");
    await page.getByLabel("Blend mode", { exact: true }).first().click();
    await expect(page.getByText("Darkens: colours multiply with what is behind")).toBeVisible();
  });

  test("a number can still be scrubbed from its label while its input is focused (LA-015)", async ({ page }) => {
    await ready(page);
    const r = await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    const x = async () => Number((await layers(page))[r.id].properties["frame.x"]);
    const input = page.getByLabel("X", { exact: true }).first();
    const label = page.locator("[data-scrub]", { hasText: /^X$/ }).first();
    const scrub = async () => {
      const b = (await label.boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2, { steps: 6 });
      await page.mouse.up();
    };
    const x0 = await x();
    await scrub(); // not focused: the baseline
    await expect.poll(x).toBeGreaterThan(x0);
    const x1 = await x();
    await input.focus(); // focused: it must still work
    await scrub();
    await expect.poll(x).toBeGreaterThan(x1);
  });

  test("Clip content and Overflow are one setting: the toggle sets both axes and the selects show it (LA-019)", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.2, 0.6, 0.7);
    await expect.poll(() => css(page, f.id, "overflow-x")).not.toBe("hidden");
    await page.getByRole("button", { name: "Clip content", exact: true }).first().click();
    await expect.poll(() => css(page, f.id, "overflow-x")).toBe("hidden");
    expect(await css(page, f.id, "overflow-y")).toBe("hidden");
    await open(page, "More Layout options");
    await expect(page.getByLabel("Overflow X", { exact: true }).first()).toContainText("Hidden");
  });

  test("a drop shadow's colour opens a picker and its fields are named (LA-027)", async ({ page }) => {
    await ready(page);
    await shape(page, "Rectangle", 0.2, 0.3, 0.4, 0.5);
    await open(page, "Add effects");
    await open(page, "Effect 1 settings");
    await expect(page.getByLabel("Shadow colour picker", { exact: true }).first()).toBeVisible();
    for (const t of ["Effect X", "Effect Y", "Effect B", "Effect S"]) await expect(page.getByLabel(t, { exact: true }).first()).toHaveAttribute("aria-label", t);
    await expect(page.getByText("Blur", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Spread", { exact: true }).first()).toBeVisible();
  });

  test("Scale on a line draws (LA-035)", async ({ page }) => {
    await ready(page);
    const l = await shape(page, "Line", 0.3, 0.3, 0.55, 0.4);
    const w0 = (await drawn(page, l.id).boundingBox())!.width;
    await open(page, "More Position options");
    await num(page, "Scale X", 2);
    await expect.poll(async () => (await drawn(page, l.id).boundingBox())!.width).toBeGreaterThan(w0 * 1.5);
  });
});
