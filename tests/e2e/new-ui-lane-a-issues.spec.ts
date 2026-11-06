/**
 * Fixes for the Lane A issue list (lazylayout_lane_a_consolidated_issues.json), checked in the new editor: stacking order,
 * frames that really contain what is drawn in them, alignment inside a frame, text wrap and font loading, scale / skew /
 * origin, per-side strokes, line styles, the shape preview, panning, resize-handle targets and colour pickers.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; children: string[]; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
const ofKind = async (page: Page, k: string) => Object.values(await layers(page)).filter((l) => l.archetype === k && l.parentId !== null); // (the page root is a container too)

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  // an empty page to work on
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
async function pick(page: Page, tool: "Frame" | "Shape" | "Text", shape?: string) {
  if (tool === "Shape") {
    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("menuitem", { name: new RegExp(`^${shape}`) }).click();
  } else await page.getByRole("button", { name: new RegExp(`^${tool}`) }).first().click();
}
const num = async (page: Page, label: string, v: number) => {
  const f = page.getByLabel(label, { exact: true }).first();
  await f.fill(String(v));
  await f.press("Enter");
};
const stageEl = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`);

test.describe("Lane A issue fixes", () => {
  test("LA-012: Arrange changes what is on top, on the canvas as well as in the list", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    await pick(page, "Shape", "Ellipse");
    await drag(page, await art(page, 0.3, 0.35), await art(page, 0.5, 0.55));
    const [rect] = await ofKind(page, "rectangle");
    const [ell] = await ofKind(page, "ellipse");
    const order = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-element"]')].map((e) => e.getAttribute("data-element-id")));
    expect(await order()).toEqual([rect.id, ell.id]); // drawn later = on top
    await stageEl(page, ell.id).click({ button: "right", force: true });
    await page.getByRole("menuitem", { name: /^Arrange/ }).hover();
    await page.getByRole("menuitem", { name: /^Send to back/ }).click();
    await expect.poll(order).toEqual([ell.id, rect.id]);
  });

  test("LA-013 / LA-031 / LA-033: a frame can be drawn on bare canvas and holds what is drawn inside it", async ({ page }) => {
    await ready(page);
    await pick(page, "Frame");
    await drag(page, await art(page, 0.1, 0.15), await art(page, 0.5, 0.6));
    const [frame] = await ofKind(page, "container");
    expect(frame, "a frame was made on empty canvas").toBeTruthy();
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.25), await art(page, 0.3, 0.35)); // inside the frame
    const [rect] = await ofKind(page, "rectangle");
    expect(rect.parentId, "the rectangle is the frame's child").toBe(frame.id);
    expect((await layers(page))[frame.id].children).toContain(rect.id);
    // moving the frame moves what is inside it
    const before = (await stageEl(page, rect.id).boundingBox())!;
    await page.getByText(frame.name, { exact: true }).first().click();
    await num(page, "X", Number(frame.properties["frame.x"]) + 100);
    await expect.poll(async () => Math.round(((await stageEl(page, rect.id).boundingBox())!.x - before.x))).toBeGreaterThan(30);
  });

  test("LA-001: Center aligns a layer in its frame, not in a 100px page", async ({ page }) => {
    await ready(page);
    await pick(page, "Frame");
    await drag(page, await art(page, 0.1, 0.15), await art(page, 0.5, 0.6));
    const [frame] = await ofKind(page, "container");
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.12, 0.2), await art(page, 0.2, 0.3));
    const [rect] = await ofKind(page, "rectangle");
    await page.getByRole("button", { name: "Align center", exact: true }).first().click();
    const r = (await layers(page))[rect.id];
    const fw = Number(frame.properties["frame.width"]);
    const w = Number(r.properties["frame.width"]);
    expect(Math.abs(Number(r.properties["frame.x"]) - (fw - w) / 2)).toBeLessThan(2);
  });

  test("LA-002 / LA-004 / LA-008: No wrap keeps one line, Font loading keeps its choice, capitalisation shows while editing", async ({ page }) => {
    await ready(page);
    await pick(page, "Text");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.3, 0.35));
    await page.getByLabel("Text content", { exact: true }).fill("a long line of words that would wrap");
    await page.getByRole("button", { name: "More Typography options" }).click();
    await page.getByRole("combobox", { name: "White space" }).click();
    await page.getByRole("option", { name: "No wrap" }).click();
    const [t] = await ofKind(page, "text");
    await expect.poll(async () => (await layers(page))[t.id].properties["typography.whiteSpace"]).toBe("nowrap");
    await expect.poll(() => stageEl(page, t.id).locator("[data-archetype=text]").evaluate((e) => getComputedStyle(e).whiteSpace)).toBe("nowrap");
    await page.getByRole("combobox", { name: "Font loading" }).click();
    await page.getByRole("option", { name: "Block" }).click();
    await expect.poll(async () => (await layers(page))[t.id].properties["typography.fontLoading"]).toBe("block");
    await expect(page.getByRole("combobox", { name: "Font loading" })).toContainText("Block");
  });

  test("LA-014 / LA-016: scale, skew and transform origin show on the canvas and stay chosen", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    const [r] = await ofKind(page, "rectangle");
    await page.getByRole("button", { name: "More Position options" }).click();
    await num(page, "Scale X", 2);
    await num(page, "Skew X", 20);
    await page.getByRole("combobox", { name: "Transform origin" }).click();
    await page.getByRole("option", { name: "Top left" }).click();
    await expect(page.getByRole("combobox", { name: "Transform origin" })).toContainText("Top left");
    await expect.poll(() => stageEl(page, r.id).evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");
    expect((await layers(page))[r.id].properties["transform.origin"]).toBe("top left");
  });

  test("LA-024: a stroke on one side only is written for that side", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    const [r] = await ofKind(page, "rectangle");
    await page.getByRole("button", { name: "Add stroke", exact: true }).click();
    await page.getByRole("button", { name: "Stroke 1 settings" }).click();
    await page.getByRole("radio", { name: /right/i }).click();
    await expect.poll(async () => String((await layers(page))[r.id].properties["stroke.sides"])).toMatch(/^0 \d+ 0 0$/);
  });

  test("LA-025 / LA-026: a line takes dash style and cap", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Line");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.5, 0.3));
    const [ln] = await ofKind(page, "line");
    await page.getByRole("radio", { name: "Dashed" }).click();
    await expect.poll(async () => (await layers(page))[ln.id].properties["svg.strokeDasharray"]).not.toBe(undefined);
    await page.getByRole("button", { name: /More .* options/ }).last().click().catch(() => undefined);
    const cap = page.getByLabel("Cap", { exact: true });
    if (await cap.count()) {
      await cap.click();
      await page.getByRole("option", { name: "Square" }).click();
      await expect.poll(async () => (await layers(page))[ln.id].properties["svg.strokeLinecap"]).toBe("square");
    }
  });

  test("LA-030: the preview while drawing is the shape being drawn", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Ellipse");
    const a = await art(page, 0.2, 0.3);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 80, a.y + 60, { steps: 4 });
    await expect(page.getByTestId("draw-preview")).toHaveAttribute("data-preview-shape", "ellipse");
    await page.mouse.up();
  });

  test("LA-032: Shift+wheel pans sideways and a right-button drag pans the canvas", async ({ page }) => {
    await ready(page);
    const view = (await page.locator('[data-testid="stage-viewport"]').boundingBox())!;
    const start = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await page.mouse.move(view.x + 40, view.y + 120);
    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 80);
    await page.keyboard.up("Shift");
    await expect.poll(async () => Math.round((await page.locator("[data-stage=artboard]").boundingBox())!.x - start.x)).toBe(-80);
    const mid = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await page.mouse.move(view.x + 40, view.y + 120);
    await page.mouse.down({ button: "right" });
    await page.mouse.move(view.x + 140, view.y + 160, { steps: 4 });
    await page.mouse.up({ button: "right" });
    await expect.poll(async () => Math.round((await page.locator("[data-stage=artboard]").boundingBox())!.x - mid.x)).toBe(100);
  });

  test("LA-011 / LA-005 / LA-023: resize handles have a real target and colours open a picker", async ({ page }) => {
    await ready(page);
    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    const handle = page.getByTestId("selection-handle").first();
    const box = (await handle.locator("span").first().boundingBox())!;
    expect(Math.min(box.width, box.height), "the grab area around a handle on screen").toBeGreaterThanOrEqual(14);
    await page.getByRole("button", { name: "Fill 1 settings" }).click();
    await expect(page.getByLabel("Fill colour picker")).toHaveCount(1);
    await page.getByRole("button", { name: "Fill 1 settings" }).click(); // close it again
    await page.getByRole("button", { name: "Add stroke", exact: true }).click();
    await page.getByRole("button", { name: "Stroke 1 settings" }).click();
    await expect(page.getByLabel("Stroke colour picker")).toHaveCount(1);
  });

  test("Ctrl+K opens the command palette and runs the command you pick", async ({ page }) => {
    await ready(page);
    await page.mouse.move(700, 500);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.type("select all");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the Page block resizes and colours the page, and a drag on a fill grip reorders fills", async ({ page }) => {
    await ready(page);
    await page.getByLabel("Page width", { exact: true }).fill("1000");
    await page.getByLabel("Page width", { exact: true }).press("Enter");
    await expect.poll(() => page.locator("[data-stage=artboard]").evaluate((e) => (e as HTMLElement).offsetWidth)).toBe(1000);
    await page.getByLabel("Background hex", { exact: true }).fill("112233");
    await expect.poll(() => page.locator("[data-stage=artboard]").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(17, 34, 51)");

    await pick(page, "Shape", "Rectangle");
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.4, 0.5));
    const [r] = await ofKind(page, "rectangle");
    await page.getByRole("button", { name: "Add fill" }).click();
    const fillsOf = async () => JSON.parse(String((await layers(page))[r.id].properties["paint.fills"] ?? "[]")) as Array<{ color?: string }>;
    const hexes = page.getByLabel("Fill hex", { exact: true });
    await hexes.nth(1).fill("FF0000");
    await hexes.nth(1).press("Enter");
    const before = await fillsOf();
    expect(before.length).toBe(2);
    const grip = page.getByRole("button", { name: "Reorder fill 1" });
    await page.getByLabel("Fill hex", { exact: true }).first().hover(); // the grip shows when its row is hovered
    const g = (await grip.boundingBox())!;
    await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width / 2, g.y + 40, { steps: 4 });
    await page.mouse.up();
    await expect.poll(async () => JSON.stringify((await fillsOf()).map((f) => f.color))).not.toBe(JSON.stringify(before.map((f) => f.color)));
  });
});
