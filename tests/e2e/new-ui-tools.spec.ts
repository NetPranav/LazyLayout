/**
 * The new editor's bottom bar and canvas, connected to the engine again, in Chromium, Firefox and WebKit: the Frame,
 * Shape and Text tools draw a real layer by dragging (and the layer shows on the canvas), a tool hands back to Select, a
 * drawn layer is one undo step, the Hand tool and the wheel move the canvas, a new shape can be selected, moved and
 * painted from the inspector, and the right-click menu's Arrange and Duplicate act on the layer.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";

type Doc = { get: () => { layers: Record<string, { id: string; archetype: string; name: string; parentId: string | null; children: string[]; properties: Record<string, unknown> }> } };

const layers = (page: Page) => page.evaluate(() => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers);
const ofKind = async (page: Page, archetype: string) => Object.values(await layers(page)).filter((l) => l.archetype === archetype);
const count = async (page: Page) => Object.keys(await layers(page)).length;

async function ready(page: Page) {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.locator("body").click({ position: { x: 700, y: 140 } }); // focus the app and clear the selection
}

/** A point on the artboard, as fractions of its on-screen box. */
const artboardAt = async (page: Page, fx: number, fy: number) => {
  const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
  return { x: b.x + b.width * fx, y: b.y + b.height * fy };
};

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.mouse.up();
}

const selectPressed = (page: Page) => page.getByRole("button", { name: "Select (V)", exact: true }).first().getAttribute("aria-pressed");
/** A row of the Layers panel (the left panel) with this name. */
const inLayersPanel = (page: Page, name: string) =>
  page.evaluate((n) => Array.from(document.querySelectorAll("*")).some((e) => e.children.length === 0 && (e.textContent ?? "").trim() === n && e.getBoundingClientRect().x < 250 && e.getBoundingClientRect().width > 0), name);
const stageElement = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`);

async function pickShape(page: Page, name: string) {
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: new RegExp(`^${name}`) }).click();
}

test.use({ viewport: { width: 1600, height: 1000 } }); // the page is drawn at its real size, so give it room

test.describe("the new editor's drawing tools", () => {
  test("Frame, every Shape and Text draw a layer by dragging, show it on the canvas, and hand back to Select", async ({ page }) => {
    await ready(page);
    const plan: [string, () => Promise<void>, string][] = [
      ["Frame", () => page.getByRole("button", { name: "Frame (F)", exact: true }).click(), "container"],
      ["Rectangle", () => pickShape(page, "Rectangle"), "rectangle"],
      ["Ellipse", () => pickShape(page, "Ellipse"), "ellipse"],
      ["Line", () => pickShape(page, "Line"), "line"],
      ["Arrow", () => pickShape(page, "Arrow"), "arrow"],
      ["Polygon", () => pickShape(page, "Polygon"), "polygon"],
      ["Star", () => pickShape(page, "Star"), "star"],
      ["Text", () => page.getByRole("button", { name: "Text (T)", exact: true }).click(), "text"],
    ];
    for (const [i, [label, pick, archetype]] of plan.entries()) {
      const before = (await ofKind(page, archetype)).length;
      await pick();
      const x = 0.06 + (i % 4) * 0.22;
      const y = 0.3 + Math.floor(i / 4) * 0.3;
      await drag(page, await artboardAt(page, x, y), await artboardAt(page, x + 0.14, y + 0.2));
      const made = await ofKind(page, archetype);
      expect(made.length, `${label} made a ${archetype}`).toBe(before + 1);
      const layer = made[made.length - 1];
      expect(layer.parentId, `${label} is in the page`).not.toBeNull();
      await expect(stageElement(page, layer.id), `${label} is on the canvas`).toBeVisible();
      expect(await selectPressed(page), `after ${label} the tool is Select again`).toBe("true");
      await expect.poll(() => inLayersPanel(page, layer.name), `${label} is in the Layers panel`).toBe(true);
    }
    // the shapes are really drawn by the engine, not empty boxes
    for (const kind of ["rectangle", "ellipse", "star", "polygon"]) {
      const all = await ofKind(page, kind);
      const l = all[all.length - 1];
      await expect(stageElement(page, l.id).locator("svg").first(), `a ${kind} is drawn`).toBeVisible();
    }
  });

  test("the keyboard shortcuts arm the tools: R draws a rectangle, O an ellipse, T text", async ({ page }) => {
    await ready(page);
    for (const [key, archetype, fx] of [["r", "rectangle", 0.1], ["o", "ellipse", 0.35], ["t", "text", 0.6]] as const) {
      const before = (await ofKind(page, archetype)).length;
      await page.keyboard.press(key);
      await drag(page, await artboardAt(page, fx, 0.55), await artboardAt(page, fx + 0.18, 0.75));
      expect((await ofKind(page, archetype)).length, key).toBe(before + 1);
    }
  });

  test("a drawn layer is one undo step, and redo brings it back", async ({ page }) => {
    await ready(page);
    const n0 = await count(page);
    await pickShape(page, "Star");
    await drag(page, await artboardAt(page, 0.2, 0.55), await artboardAt(page, 0.4, 0.8));
    expect(await count(page)).toBe(n0 + 1);
    await page.getByRole("button", { name: /^Undo/ }).click();
    await expect.poll(() => count(page)).toBe(n0);
    await page.getByRole("button", { name: /^Redo/ }).click();
    await expect.poll(() => count(page)).toBe(n0 + 1);
  });

  test("a drag on bare canvas, outside the page, still draws (LA-031)", async ({ page }) => {
    await ready(page);
    const n0 = await count(page);
    await pickShape(page, "Rectangle");
    const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await drag(page, { x: b.x + 20, y: b.y - 40 }, { x: b.x + 120, y: b.y - 10 });
    expect(await count(page)).toBe(n0 + 1);
  });

  test("a new shape can be selected, moved by dragging, resized and painted from the inspector", async ({ page }) => {
    await ready(page);
    await pickShape(page, "Rectangle");
    await drag(page, await artboardAt(page, 0.1, 0.5), await artboardAt(page, 0.3, 0.7));
    const [shape] = await ofKind(page, "rectangle");
    // it is selected as soon as it is drawn, and the inspector is about it
    await expect(stageElement(page, shape.id)).toHaveAttribute("data-selected", "true");
    // the inspector shows real values, not "Mixed", for a layer that has not set them
    await expect(page.getByText("Mixed", { exact: false })).toHaveCount(0);
    // move it with the mouse
    const box = (await stageElement(page, shape.id).boundingBox())!;
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2 + 60, y: box.y + box.height / 2 + 20 });
    await expect.poll(async () => (await layers(page))[shape.id].properties["frame.x"]).not.toBe(shape.properties["frame.x"]);
    // size and paint from the inspector
    const w = page.getByLabel("W", { exact: true }).first();
    await w.fill("150");
    await w.press("Enter");
    await expect.poll(async () => (await layers(page))[shape.id].properties["frame.width"]).toBe(150);
    const hex = page.getByLabel("Fill hex").first();
    await hex.fill("FF0000");
    await hex.press("Enter");
    await expect
      .poll(async () => {
        const props = (await layers(page))[shape.id].properties;
        const fills = props["paint.fills"] ? JSON.parse(String(props["paint.fills"])) : [];
        return String(fills[0]?.color ?? props["svg.fill"]).toLowerCase();
      })
      .toMatch(/#ff0000|rgb\(255, 0, 0\)/);
    await expect(stageElement(page, shape.id).locator("rect").first()).toHaveAttribute("fill", "#FF0000");
    // a stroke and an opacity from the inspector land on the shape's own properties
    await page.getByRole("button", { name: "Add stroke" }).first().click();
    await expect.poll(async () => Number((await layers(page))[shape.id].properties["svg.strokeWidth"])).toBeGreaterThan(0);
    const op = page.getByLabel("Opacity").first();
    await op.fill("50");
    await op.press("Enter");
    await expect.poll(async () => (await layers(page))[shape.id].properties["appearance.opacity"]).toBe(0.5);
  });

  test("the right-click menu acts on a drawn layer: Duplicate, Arrange > Send to back, Delete", async ({ page }) => {
    await ready(page);
    await pickShape(page, "Ellipse");
    await drag(page, await artboardAt(page, 0.1, 0.5), await artboardAt(page, 0.3, 0.7));
    const [shape] = await ofKind(page, "ellipse");
    const n0 = await count(page);
    const menu = page.getByRole("menu");
    const rightClick = async (id: string) => {
      await stageElement(page, id).click({ button: "right", force: true });
    };

    // Duplicate: a copy lands exactly on top of the original, and is the selection
    await rightClick(shape.id);
    await page.getByRole("menuitem", { name: /^Duplicate/ }).click();
    await expect.poll(() => count(page)).toBe(n0 + 1);
    await expect(menu).toHaveCount(0);
    const copy = (await ofKind(page, "ellipse")).find((l) => l.id !== shape.id)!;
    expect(copy, "the duplicate is a layer of its own").toBeTruthy();

    // Arrange > Send to back moves the copy to the bottom of the page
    const pageId = Object.values(await layers(page)).find((l) => l.parentId === null)!.id;
    await rightClick(copy.id);
    await page.getByRole("menuitem", { name: /^Arrange/ }).hover();
    await page.getByRole("menuitem", { name: /^Send to back/ }).click();
    // the two sit exactly on each other, so the click may land on either: whichever it was goes to the bottom of the page
    await expect
      .poll(async () => {
        const kids = (await layers(page))[pageId].children;
        return kids.indexOf(copy.id) === 0 || kids.indexOf(shape.id) === 0;
      })
      .toBe(true);
    await expect(menu).toHaveCount(0);

    // Delete takes away the layer that was right-clicked (the two sit exactly on each other); the other stays
    await rightClick(shape.id);
    await page.getByRole("menuitem", { name: /^Delete/ }).click();
    await expect.poll(async () => (await ofKind(page, "ellipse")).length).toBe(1);
    expect(await count(page)).toBe(n0);
  });
});

test.describe("moving around the canvas", () => {
  test("the Hand tool pans the artboard, and Select does not", async ({ page }) => {
    await ready(page);
    const start = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await page.getByRole("button", { name: "Hand (H)", exact: true }).first().click();
    await drag(page, { x: start.x + 200, y: start.y + 150 }, { x: start.x + 290, y: start.y + 210 });
    const panned = (await page.locator("[data-stage=artboard]").boundingBox())!;
    expect(Math.round(panned.x - start.x)).toBe(90);
    expect(Math.round(panned.y - start.y)).toBe(60);
    await page.getByRole("button", { name: "Select (V)", exact: true }).first().click();
    await page.mouse.move(panned.x - 5, panned.y - 60);
    await page.mouse.down();
    await page.mouse.move(panned.x + 40, panned.y - 20, { steps: 3 });
    await page.mouse.up();
    const after = (await page.locator("[data-stage=artboard]").boundingBox())!;
    expect(Math.round(after.x - panned.x)).toBe(0);
  });

  test("the wheel pans, and Ctrl or Cmd with the wheel zooms", async ({ page, browserName }) => {
    await ready(page);
    const start = (await page.locator("[data-stage=artboard]").boundingBox())!;
    const view = (await page.locator('[data-testid="stage-viewport"]').boundingBox())!;
    await page.mouse.move(view.x + 40, view.y + 120); // over the canvas, whatever size the page is
    await page.mouse.wheel(0, 80);
    await expect.poll(async () => Math.round((await page.locator("[data-stage=artboard]").boundingBox())!.y - start.y)).toBe(-80);
    test.skip(browserName !== "chromium", "Ctrl+wheel is a browser zoom gesture that only Chromium delivers to the page here");
    const before = (await page.locator("[data-stage=artboard]").boundingBox())!.width;
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -120);
    await page.keyboard.up("Control");
    await expect.poll(async () => (await page.locator("[data-stage=artboard]").boundingBox())!.width).toBeGreaterThan(before);
  });
});
