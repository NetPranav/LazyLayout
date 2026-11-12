/**
 * The canvas drawn through the engine: what is on it is the real tree, so an edit to any layer (a sample one too) shows,
 * a frame's visibility, opacity and clip reach its children, auto layout really lays out, each shortcut fires once, an
 * emptied page stays empty, and a project saved by an older build opens at the right page size. Also the gestures the
 * rewrite touched: marquee, Shift-click and Alt-drag.
 */
import path from "node:path";
import { PNG } from "pngjs";
import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved, pickShape } from "./support/editor";

type L = { id: string; archetype: string; name: string; parentId: string | null; children: string[]; visible?: boolean; properties: Record<string, unknown> };
type Win = { __LL_TEST__: boolean; __LL_DOC__: { get: () => { layers: Record<string, L> }; commands: { updateProps: (id: string, p: Record<string, unknown>) => void } } };

const layers = (page: Page) => page.evaluate(() => (window as unknown as Win).__LL_DOC__.get().layers);
const count = async (page: Page) => Object.keys(await layers(page)).length;
const ofKind = async (page: Page, k: string) => Object.values(await layers(page)).filter((l) => l.archetype === k && l.parentId !== null);
const setProps = (page: Page, id: string, props: Record<string, unknown>) =>
  page.evaluate(([i, p]) => (window as unknown as Win).__LL_DOC__.commands.updateProps(i as string, p as Record<string, unknown>), [id, props] as const);

const hit = (page: Page, id: string) => page.locator(`[data-testid="stage-element"][data-element-id="${id}"]`);
const drawn = (page: Page, id: string) => page.locator(`[data-testid="stage-page"] [data-archetype][data-element-id="${id}"]`);
const selected = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-element"][data-selected="true"]')].map((e) => e.getAttribute("data-element-id")));

test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page, { empty = true } = {}) {
  await page.addInitScript(() => ((window as unknown as Win).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  if (!empty) return;
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
async function rectangle(page: Page, x1: number, y1: number, x2: number, y2: number) {
  const before = new Set((await ofKind(page, "rectangle")).map((l) => l.id));
  const shape = page.getByRole("button", { name: "Shape", exact: true });
  await pickShape(page, "Rectangle");
  await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  // the tool hands back to Select after a draw; a Shape click made before that is closed again by the hand-back
  await expect(shape).not.toHaveAttribute("aria-pressed", "true");
  return (await ofKind(page, "rectangle")).find((l) => !before.has(l.id))!;
}
async function frame(page: Page, x1: number, y1: number, x2: number, y2: number) {
  await page.getByRole("button", { name: /^Frame/ }).first().click();
  await drag(page, await art(page, x1, y1), await art(page, x2, y2));
  return (await ofKind(page, "container")).pop()!;
}
const clickCentre = async (page: Page, id: string, modifier?: "Shift") => {
  const b = (await hit(page, id).boundingBox())!;
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  if (modifier) await page.keyboard.up(modifier);
};

test.describe("the canvas draws the real tree", () => {
  test("an edit to a sample layer shows on the canvas", async ({ page }) => {
    await ready(page, { empty: false });
    await setProps(page, "button", { "appearance.background.color": "#FF0000", "appearance.radius": 20 });
    await expect.poll(() => drawn(page, "button").evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(255, 0, 0)");
    await expect.poll(() => drawn(page, "button").evaluate((e) => getComputedStyle(e).borderTopLeftRadius)).toBe("20px");
  });

  test("a frame's hide, opacity and clip reach what is inside it", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.15, 0.5, 0.6);
    const r = await rectangle(page, 0.2, 0.25, 0.3, 0.35);
    expect(r.parentId).toBe(f.id);

    await setProps(page, f.id, { "appearance.opacity": 0.4 });
    await expect.poll(() => drawn(page, f.id).evaluate((e) => getComputedStyle(e).opacity)).toBe("0.4");
    await expect(drawn(page, f.id).locator(`[data-element-id="${r.id}"]`), "the child is drawn inside the frame").toHaveCount(1);

    await setProps(page, f.id, { "layout.overflowX": "hidden", "layout.overflowY": "hidden" });
    await expect.poll(() => drawn(page, f.id).evaluate((e) => getComputedStyle(e).overflow)).toBe("hidden");

    await page.getByText(f.name, { exact: true }).first().click();
    await page.keyboard.press("Control+Shift+h");
    await expect.poll(async () => (await layers(page))[f.id].visible).toBe(false);
    await expect(drawn(page, r.id), "a hidden frame hides its child").not.toBeVisible();
  });

  test("Stack, gap and Fill lay the children out", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.1, 0.15, 0.7, 0.6);
    const a = await rectangle(page, 0.15, 0.2, 0.25, 0.3);
    const b = await rectangle(page, 0.3, 0.2, 0.4, 0.3);
    await page.getByText(f.name, { exact: true }).first().click();
    // the direction control is Free / Row / Column / Grid: Row is the horizontal stack
    await page.getByRole("radio", { name: "Auto layout row" }).click();
    const gap = page.getByLabel("Gap", { exact: true }).first();
    await gap.fill("30");
    await gap.press("Enter");
    await expect.poll(async () => {
      const ba = (await drawn(page, a.id).boundingBox())!;
      const bb = (await drawn(page, b.id).boundingBox())!;
      return Math.round(Math.abs(bb.x - (ba.x + ba.width)) / ((await page.locator("[data-stage=artboard]").boundingBox())!.width / 1440));
    }, "the gap is on the canvas").toBe(30);

    // Fill takes what is left of the frame's width
    const wide = (await drawn(page, b.id).boundingBox())!.width;
    await page.getByText(b.name, { exact: true }).first().click();
    await page.getByRole("combobox", { name: "Width sizing" }).click();
    await page.getByRole("option", { name: "Fill" }).click();
    await expect.poll(async () => (await drawn(page, b.id).boundingBox())!.width).toBeGreaterThan(wide);
    // W shows what Fill worked out, not a stale or empty number, and typing a size makes it fixed again
    const stored = Number((await layers(page))[b.id].properties["frame.width"]);
    const w = page.getByLabel("W", { exact: true }).first();
    await expect.poll(async () => Number(await w.inputValue())).toBeGreaterThan(stored);
    await w.fill("120");
    await w.press("Enter");
    await expect.poll(async () => (await layers(page))[b.id].properties["sizing.horizontal"]).toBe("fixed");
    await expect.poll(async () => (await layers(page))[b.id].properties["frame.width"]).toBe(120);
  });

  test("a line's shadow is drawn, not cut off by its thin box", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: "Shape", exact: true }).click();
    await page.getByRole("menuitem", { name: /^Line/ }).click();
    await drag(page, await art(page, 0.2, 0.3), await art(page, 0.5, 0.3));
    const [line] = await ofKind(page, "line");
    expect(line).toBeTruthy();
    await setProps(page, line.id, { "paint.shadows": JSON.stringify([{ x: 0, y: 8, blur: 12, spread: 0, color: "#000000", inset: false, visible: true }]) });
    const filter = drawn(page, line.id).locator("filter");
    await expect(filter.first()).toBeAttached();
    expect(await filter.first().getAttribute("filterUnits")).toBe("userSpaceOnUse");
  });

  test("a drawn shape says Fixed, as that is how it is drawn", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    await clickCentre(page, r.id);
    await expect(page.getByRole("combobox", { name: "Width sizing" })).toContainText("Fixed");
    await expect(page.getByRole("combobox", { name: "Height sizing" })).toContainText("Fixed");
  });

  test("Insert > Sections adds a real section to the page on screen", async ({ page }) => {
    await ready(page);
    const before = await count(page);
    await page.getByRole("button", { name: /Insert/ }).first().click();
    await page.getByText("Sections", { exact: true }).first().click();
    await page.locator("[data-testid=section-card][data-template=hero]").click();
    await expect.poll(() => count(page)).toBeGreaterThan(before);
    const added = Object.values(await layers(page)).filter((l) => l.parentId !== null);
    await expect(drawn(page, added[0].id)).toBeVisible();
  });
});

test.describe("shortcuts fire once", () => {
  test("Duplicate adds one layer, Undo takes back one step, Delete removes one", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    await clickCentre(page, r.id);
    await page.locator("[data-stage=artboard]").hover();
    const n = await count(page);
    await page.keyboard.press("Control+d");
    await expect.poll(() => count(page)).toBe(n + 1);
    await page.waitForTimeout(200);
    expect(await count(page), "one copy, not two").toBe(n + 1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => count(page)).toBe(n);
    await page.waitForTimeout(200);
    expect((await layers(page))[r.id], "undo took back one step, not the drawing too").toBeTruthy();
    await clickCentre(page, r.id);
    await page.keyboard.press("Delete");
    await expect.poll(() => count(page)).toBe(n - 1);
  });
});

test.describe("gestures", () => {
  test("marquee on empty canvas selects what it touches", async ({ page }) => {
    await ready(page);
    const a = await rectangle(page, 0.2, 0.3, 0.27, 0.38);
    const b = await rectangle(page, 0.32, 0.3, 0.39, 0.38);
    const c = await rectangle(page, 0.6, 0.6, 0.67, 0.68);
    await drag(page, await art(page, 0.15, 0.25), await art(page, 0.45, 0.45));
    await expect.poll(async () => (await selected(page)).sort()).toEqual([a.id, b.id].sort());
    expect(await selected(page)).not.toContain(c.id);
  });

  test("a drag through empty space selects every element it touches, inside frames too, and the Layers list shows them all", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.08, 0.1, 0.5, 0.7);
    const a = await rectangle(page, 0.12, 0.2, 0.2, 0.3);
    const b = await rectangle(page, 0.26, 0.2, 0.34, 0.3);
    expect([a.parentId, b.parentId]).toEqual([f.id, f.id]);
    const c = await rectangle(page, 0.62, 0.2, 0.7, 0.3);
    const chosen = () => page.evaluate(() => [...document.querySelectorAll('#p-layers .row[aria-selected="true"]')].map((e) => e.getAttribute("data-sel")));

    // fold the frame in the list, then sweep from empty space across everything
    await page.locator(`#p-layers .row[data-sel="${f.id}"]`).getByRole("button", { name: "Collapse" }).click();
    await expect(page.locator(`#p-layers .row:not(.lcl)[data-sel="${a.id}"]`)).toHaveCount(0);
    await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
    await drag(page, await art(page, 0.02, 0.03), await art(page, 0.9, 0.5));

    await expect.poll(async () => (await selected(page)).sort(), "the canvas selects the shapes inside the frame too").toEqual([a.id, b.id, c.id].sort());
    await expect.poll(async () => (await chosen()).sort(), "and the list shows every one of them selected, the frame unfolded").toEqual([a.id, b.id, c.id].sort());
    expect(await selected(page), "not the frame as well as what is in it").not.toContain(f.id);

    // sweeping only the frame's empty part (from outside it) picks the frame
    await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
    await drag(page, await art(page, 0.56, 0.6), await art(page, 0.45, 0.64));
    await expect.poll(() => selected(page)).toEqual([f.id]);
  });

  test("Shift-click adds to the selection and takes away from it", async ({ page }) => {
    await ready(page);
    const a = await rectangle(page, 0.2, 0.3, 0.27, 0.38);
    const b = await rectangle(page, 0.32, 0.3, 0.39, 0.38);
    await clickCentre(page, a.id);
    await clickCentre(page, b.id, "Shift");
    await expect.poll(async () => (await selected(page)).sort()).toEqual([a.id, b.id].sort());
    await clickCentre(page, a.id, "Shift");
    await expect.poll(() => selected(page)).toEqual([b.id]);
  });

  test("Alt-drag leaves the original and moves a copy, as one undo step", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    await clickCentre(page, r.id);
    const x0 = Number((await layers(page))[r.id].properties["frame.x"]);
    const n = await count(page);
    const box = (await hit(page, r.id).boundingBox())!;
    const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    await page.keyboard.down("Alt");
    await drag(page, from, { x: from.x + 30, y: from.y + 10 }); // still overlapping what it leaves behind
    await page.keyboard.up("Alt");
    await expect.poll(() => count(page)).toBe(n + 1);
    const rects = await ofKind(page, "rectangle");
    const xs = rects.map((l) => Number(l.properties["frame.x"]));
    expect(xs, "a copy stays where the layer was").toContain(x0);
    const held = rects.find((l) => Number(l.properties["frame.x"]) > x0)!;
    expect(held, "and what is held moved").toBeTruthy();
    const order = (await layers(page))[held.parentId!].children;
    expect(order.indexOf(held.id), "what is held is on top of the copy").toBe(order.length - 1);
    await page.keyboard.press("Control+z");
    await expect.poll(() => count(page)).toBe(n);
  });
});

test.describe("what goes under what", () => {
  const parentOf = async (page: Page, id: string) => (await layers(page))[id].parentId;
  async function picture(page: Page) {
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: /^Image/ }).first().click();
    await (await chooser).setFiles(path.join(__dirname, "fixtures", "mountain-subject.svg"));
    await expect.poll(async () => (await ofKind(page, "image")).length).toBeGreaterThan(0);
    return (await ofKind(page, "image")).pop()!;
  }

  test("a new picture goes into the frame it lands on, or the selected frame, and shows on top there", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.2, 0.2, 0.8, 0.8); // the middle of the page is in this frame
    await page.locator("[data-stage=workspace]").click({ position: { x: 10, y: 400 } }); // nothing selected
    const img = await picture(page);
    expect(await parentOf(page, img.id), "it landed on the frame").toBe(f.id);
    const after = await layers(page);
    expect(after[f.id].children.at(-1)).toBe(img.id);
    const fw = Number(after[f.id].properties["frame.width"]);
    const iw = Number(after[img.id].properties["frame.width"]);
    expect(Math.abs(Number(after[img.id].properties["frame.x"]) - (fw - iw) / 2), "centred in the frame").toBeLessThan(2);
    await page.keyboard.press("Control+z");

    const other = await frame(page, 0.02, 0.1, 0.15, 0.3); // away from the middle, selected once drawn
    await page.getByText(other.name, { exact: true }).first().click();
    const second = await picture(page);
    expect(await parentOf(page, second.id), "the selected frame takes it").toBe(other.id);
  });

  test("on the canvas a layer goes by where it is let go, even when it is bigger than the frame; several go together", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.05, 0.1, 0.25, 0.3);
    const big = await rectangle(page, 0.4, 0.1, 0.9, 0.9); // much bigger than the frame
    const b = (await hit(page, big.id).boundingBox())!;
    const target = await art(page, 0.15, 0.2);
    await drag(page, { x: b.x + 15, y: b.y + 15 }, target); // its middle stays far outside the frame
    await expect.poll(() => parentOf(page, big.id)).toBe(f.id);

    // two selected rectangles dropped on a frame both go in; dropped outside they come back to the page
    const page0 = Object.values(await layers(page)).find((l) => l.parentId === null)!;
    await page.keyboard.press("Delete");
    const a1 = await rectangle(page, 0.5, 0.5, 0.56, 0.56);
    const a2 = await rectangle(page, 0.6, 0.5, 0.66, 0.56);
    await clickCentre(page, a1.id);
    await clickCentre(page, a2.id, "Shift");
    const box = (await hit(page, a1.id).boundingBox())!;
    await drag(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, target);
    await expect.poll(() => parentOf(page, a1.id)).toBe(f.id);
    expect(await parentOf(page, a2.id)).toBe(f.id);
    const again = (await hit(page, a1.id).boundingBox())!;
    await drag(page, { x: again.x + again.width / 2, y: again.y + again.height / 2 }, await art(page, 0.6, 0.7));
    await expect.poll(() => parentOf(page, a1.id)).toBe(page0.id);
    expect(await parentOf(page, a2.id)).toBe(page0.id);
  });

  test("in the Layers panel a row drops into a frame, beside a child of a frame, and to the bottom of the page", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.05, 0.1, 0.5, 0.6);
    const inside = await rectangle(page, 0.1, 0.2, 0.2, 0.3);
    expect(inside.parentId).toBe(f.id);
    const outside = await rectangle(page, 0.7, 0.2, 0.8, 0.3);
    const dotted = (id: string) => page.locator(`#p-layers .row[data-sel="${id}"]`);

    // onto a row that cannot hold anything: it goes beside that row, in the same frame, on the side it was dropped
    const dragTo = async (fromId: string, toId: string, at: number) => {
      const a = (await dotted(fromId).boundingBox())!;
      const b = (await dotted(toId).boundingBox())!;
      await page.mouse.move(a.x + 90, a.y + a.height / 2);
      await page.mouse.down();
      await page.mouse.move(a.x + 90, a.y + a.height / 2 + 12, { steps: 3 });
      await page.mouse.move(b.x + 90, b.y + b.height * at, { steps: 5 });
      await page.waitForTimeout(100);
      await page.mouse.up();
    };
    await dragTo(outside.id, inside.id, 0.1);
    await expect.poll(() => parentOf(page, outside.id)).toBe(f.id);
    const shown = () => page.evaluate(() => [...document.querySelectorAll("#p-layers .row[data-sel]")].map((e) => e.getAttribute("data-sel")));
    let list = await shown();
    expect(list.indexOf(outside.id), "dropped on the top of the row: shown above it").toBeLessThan(list.indexOf(inside.id));
    await dragTo(outside.id, inside.id, 0.9);
    await expect.poll(async () => { list = await shown(); return list.indexOf(outside.id) > list.indexOf(inside.id); }, "dropped on the bottom: below it").toBe(true);

    // back out to the page, then onto the frame's own row: on top of what it holds
    const pageRoot = Object.values(await layers(page)).find((l) => l.parentId === null)!;
    await dragTo(outside.id, f.id, 0.82);
    await expect.poll(() => parentOf(page, outside.id)).toBe(pageRoot.id);
    await dragTo(outside.id, f.id, 0.5);
    await expect.poll(() => parentOf(page, outside.id)).toBe(f.id);
    expect((await layers(page))[f.id].children.at(-1)).toBe(outside.id);

    // and below the last row: out to the bottom of the page's list
    const last = (await page.locator("#p-layers .row[data-sel]").last().boundingBox())!;
    const a = (await dotted(outside.id).boundingBox())!;
    await page.mouse.move(a.x + 90, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(a.x + 90, a.y + a.height / 2 + 12, { steps: 3 });
    await page.mouse.move(last.x + 90, last.y + last.height + 40, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await expect.poll(() => parentOf(page, outside.id)).toBe(pageRoot.id);
    expect((await layers(page))[pageRoot.id].children[0]).toBe(outside.id);
  });

  test("several selected rows drag together, and Ctrl and Shift clicks select rows", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.05, 0.1, 0.3, 0.4);
    const a = await rectangle(page, 0.5, 0.2, 0.56, 0.26);
    const b = await rectangle(page, 0.6, 0.2, 0.66, 0.26);
    const rowOf = (id: string) => page.locator(`#p-layers .row[data-sel="${id}"]`);
    const chosen = () => page.evaluate(() => [...document.querySelectorAll('#p-layers .row[aria-selected="true"]')].map((e) => e.getAttribute("data-sel")));

    await rowOf(a.id).click();
    await rowOf(b.id).click({ modifiers: ["ControlOrMeta"] });
    await expect.poll(async () => (await chosen()).sort()).toEqual([a.id, b.id].sort());
    await rowOf(f.id).click();
    await rowOf(b.id).click({ modifiers: ["Shift"] }); // the list is front to back: b, a, then the frame
    await expect.poll(async () => (await chosen()).length).toBe(3);

    await rowOf(a.id).click();
    await rowOf(b.id).click({ modifiers: ["ControlOrMeta"] });
    const from = (await rowOf(a.id).boundingBox())!;
    const to = (await rowOf(f.id).boundingBox())!;
    await page.mouse.move(from.x + 90, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 90, from.y + from.height / 2 + 12, { steps: 3 });
    await page.mouse.move(to.x + 90, to.y + to.height / 2, { steps: 5 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await expect.poll(() => parentOf(page, a.id)).toBe(f.id);
    expect(await parentOf(page, b.id)).toBe(f.id);
  });

  test("a drag on a frame that holds layers selects inside it; a click selects the frame, and then a drag moves it", async ({ page }) => {
    await ready(page);
    const f = await frame(page, 0.05, 0.1, 0.7, 0.8);
    const a = await rectangle(page, 0.15, 0.25, 0.22, 0.33);
    const b = await rectangle(page, 0.3, 0.25, 0.37, 0.33);
    const c = await rectangle(page, 0.5, 0.6, 0.57, 0.68);
    await page.locator("[data-stage=workspace]").click({ position: { x: 10, y: 400 } });
    const x0 = (await layers(page))[f.id].properties["frame.x"];

    await drag(page, await art(page, 0.1, 0.18), await art(page, 0.42, 0.42));
    await expect.poll(async () => (await selected(page)).sort()).toEqual([a.id, b.id].sort());
    expect((await layers(page))[f.id].properties["frame.x"], "the frame did not move").toBe(x0);
    expect(await selected(page)).not.toContain(c.id);

    const empty = await art(page, 0.1, 0.7);
    await page.locator("[data-stage=workspace]").click({ position: { x: 10, y: 400 } });
    await page.mouse.click(empty.x, empty.y);
    await expect.poll(() => selected(page)).toEqual([f.id]);
    await drag(page, empty, { x: empty.x + 40, y: empty.y + 20 });
    await expect.poll(async () => (await layers(page))[f.id].properties["frame.x"]).not.toBe(x0);
  });
});

test.describe("selecting in the Layers panel by dragging", () => {
  const row = (page: Page, id: string) => page.locator(`#p-layers .row[data-sel="${id}"]`);
  const chosenRows = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#p-layers .row[aria-selected="true"]')].map((e) => e.getAttribute("data-sel")));
  const sweep = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x, from.y + (to.y > from.y ? 6 : -6), { steps: 2 });
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
  };

  async function fourLayers(page: Page) {
    await ready(page);
    const ids: string[] = [];
    for (const [x1, y1] of [[0.1, 0.1], [0.3, 0.1], [0.5, 0.1], [0.7, 0.1]] as const) ids.push((await rectangle(page, x1, y1, x1 + 0.1, y1 + 0.1)).id);
    // the list runs front to back: the last drawn is on top
    return ids.reverse();
  }

  test("dragging down across rows selects them, and Delete removes them", async ({ page }) => {
    const [d, c, b, a] = await fourLayers(page);
    await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
    const first = (await row(page, d).boundingBox())!;
    const third = (await row(page, b).boundingBox())!;
    await sweep(page, { x: first.x + 100, y: first.y + first.height / 2 }, { x: third.x + 100, y: third.y + third.height / 2 });
    await expect.poll(async () => (await chosenRows(page)).sort()).toEqual([d, c, b].sort());
    await expect(page.getByTestId("layers-band"), "the box is gone after the drag").toHaveCount(0);
    await page.keyboard.press("Delete");
    await expect.poll(async () => Object.keys(await layers(page)).filter((id) => [d, c, b].includes(id)).length).toBe(0);
    expect((await layers(page))[a], "the one it did not touch is still there").toBeTruthy();
    await expect(row(page, a)).toHaveCount(1);
  });

  test("a drag up from empty space below the rows selects the rows it reaches", async ({ page }) => {
    const [d, c, b, a] = await fourLayers(page);
    await page.locator("[data-stage=workspace]").click({ position: { x: 8, y: 300 } });
    const tree = (await page.locator("#p-layers").boundingBox())!;
    const last = (await row(page, a).boundingBox())!;
    const second = (await row(page, c).boundingBox())!;
    await sweep(page, { x: tree.x + 120, y: last.y + last.height + 40 }, { x: tree.x + 120, y: second.y + second.height / 2 });
    await expect.poll(async () => (await chosenRows(page)).sort()).toEqual([c, b, a].sort());
    await page.keyboard.press("Delete");
    await expect.poll(async () => Object.keys(await layers(page)).filter((id) => [c, b, a].includes(id)).length).toBe(0);
    expect((await layers(page))[d]).toBeTruthy();
  });

  test("a click still selects one row, and dragging a selected row still reorders", async ({ page }) => {
    const [d, c, b, a] = await fourLayers(page);
    await row(page, c).click();
    await expect.poll(() => chosenRows(page)).toEqual([c]);
    // c is selected: dragging it moves it (below a, the last row), it does not select a range
    const from = (await row(page, c).boundingBox())!;
    const to = (await row(page, a).boundingBox())!;
    await sweep(page, { x: from.x + 100, y: from.y + from.height / 2 }, { x: to.x + 100, y: to.y + to.height * 0.9 });
    const parent = (await layers(page))[c].parentId!;
    await expect.poll(async () => (await layers(page))[parent].children.indexOf(c), "c went behind a").toBeLessThan((await layers(page))[parent].children.indexOf(a));
    expect(await chosenRows(page)).toEqual([c]);
    const now = await layers(page);
    expect(Boolean(now[d] && now[b]), "nothing was selected or removed besides the move").toBe(true);
  });
});

test.describe("arranging: what is on top is what you see", () => {
  const COLOURS = ["#FF0000", "#00FF00", "#0000FF"] as const;
  const NAMES = ["red", "green", "blue"] as const;

  /** Three overlapping rectangles, drawn red, green, blue (blue on top). Returns their ids in that order. */
  async function threeColours(page: Page) {
    await ready(page);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = await rectangle(page, 0.2 + i * 0.05, 0.2 + i * 0.05, 0.5 + i * 0.05, 0.5 + i * 0.05);
      await setProps(page, r.id, { "svg.fill": COLOURS[i] });
      ids.push(r.id);
    }
    return ids;
  }
  /** The colour on screen where all three overlap. */
  async function onTop(page: Page) {
    await page.mouse.move(5, 5);
    await page.waitForTimeout(250);
    const stage = page.locator('[data-testid="stage-page"]');
    const png = PNG.sync.read(await stage.screenshot());
    const box = (await stage.boundingBox())!;
    const at = await art(page, 0.35, 0.35);
    const k = png.width / box.width;
    const i = (Math.round((at.y - box.y) * k) * png.width + Math.round((at.x - box.x) * k)) * 4;
    const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
    return r > 200 && g < 60 && b < 60 ? "red" : g > 200 && r < 60 && b < 60 ? "green" : b > 200 && r < 60 && g < 60 ? "blue" : `other(${r},${g},${b})`;
  }
  const order = async (page: Page, ids: string[]) => {
    const l = await layers(page);
    const parent = l[ids[0]].parentId!;
    return l[parent].children.map((id) => NAMES[ids.indexOf(id)]).join(",");
  };

  test("Bring to front, Send to back, Bring forward and Send backward: by shortcut, each shows on screen", async ({ page }) => {
    const ids = await threeColours(page);
    expect(await onTop(page)).toBe("blue");
    await page.locator(`#p-layers .row[data-sel="${ids[0]}"]`).click(); // red, the back one
    // the pointer is over the inspector (and, between presses, in the window's corner over the top bar): the shortcuts still work
    await page.getByText("Position", { exact: true }).first().hover();
    for (const [keys, expectedOrder, expectedTop] of [
      ["Control+Alt+]", "green,blue,red", "red"],
      ["Control+Alt+[", "red,green,blue", "blue"],
      ["Control+]", "green,red,blue", "blue"],
      ["Control+]", "green,blue,red", "red"],
      ["Control+[", "green,red,blue", "blue"],
      ["Control+Shift+]", "green,blue,red", "red"],
      ["Control+Shift+[", "red,green,blue", "blue"],
    ] as const) {
      await page.keyboard.press(keys);
      await expect.poll(() => order(page, ids), `${keys}: order`).toBe(expectedOrder);
      expect(await onTop(page), `${keys}: what is on top on screen`).toBe(expectedTop);
    }
    // undo takes back the last move, and the layer stays selected throughout
    await page.keyboard.press("Control+Shift+]");
    await expect.poll(() => order(page, ids)).toBe("green,blue,red");
    await page.keyboard.press("Control+z");
    await expect.poll(() => order(page, ids)).toBe("red,green,blue");
    expect(await onTop(page)).toBe("blue");
  });

  test("the same four from the right-click Arrange menu, on the canvas and on a row in the Layers panel", async ({ page }) => {
    const ids = await threeColours(page);
    const choose = async (label: RegExp) => {
      await page.waitForTimeout(300); // a person takes a moment to reach the menu
      await page.getByRole("menuitem", { name: /^Arrange/ }).hover({ force: true });
      const item = page.getByRole("menuitem", { name: label });
      if (!(await item.isVisible().catch(() => false))) await page.getByRole("menuitem", { name: /^Arrange/ }).click();
      await item.click();
    };
    // on the canvas: red's own corner, which no other shape covers
    const corner = await art(page, 0.225, 0.225); // inside red's own strip, clear of its selection handle
    await page.mouse.click(corner.x, corner.y, { button: "right" });
    await choose(/^Bring to front/);
    await expect.poll(() => order(page, ids)).toBe("green,blue,red");
    expect(await onTop(page)).toBe("red");
    // on a row of the Layers panel: blue, now in the middle
    await page.locator(`#p-layers .row[data-sel="${ids[2]}"]`).click({ button: "right" });
    await choose(/^Send to back/);
    await expect.poll(() => order(page, ids)).toBe("blue,green,red");
    await page.locator(`#p-layers .row[data-sel="${ids[0]}"]`).click({ button: "right" }); // red, now at the front: one step back
    await choose(/^Send backward/);
    await expect.poll(() => order(page, ids)).toBe("blue,red,green");
    expect(await onTop(page)).toBe("green");
    await page.locator(`#p-layers .row[data-sel="${ids[2]}"]`).click({ button: "right" }); // blue, at the back: one step forward
    await choose(/^Bring forward/);
    await expect.poll(() => order(page, ids)).toBe("red,blue,green");
  });

  test("the Z field puts a layer over or under the others whatever the order, on the canvas", async ({ page }) => {
    const ids = await threeColours(page);
    expect(await onTop(page)).toBe("blue");
    await page.locator(`#p-layers .row[data-sel="${ids[0]}"]`).click(); // red, at the back
    await page.getByRole("button", { name: /^More/ }).first().click().catch(() => undefined);
    await setProps(page, ids[0], { "layout.zIndex": 10 });
    await expect.poll(() => onTop(page), "Z 10 on the back layer brings it to the top").toBe("red");
    expect(await order(page, ids), "the list order did not change").toBe("red,green,blue");
    await setProps(page, ids[2], { "layout.zIndex": 20 });
    await expect.poll(() => onTop(page)).toBe("blue");
    await setProps(page, ids[0], { "layout.zIndex": 0 });
    await setProps(page, ids[2], { "layout.zIndex": 0 });
    await expect.poll(() => onTop(page), "back to the order alone").toBe("blue");
  });
});

test.describe("corner pin: lay a layer on a surface", () => {
  test("the four handles move the corners, the layer is drawn in perspective, and a drag is one undo step", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.45, 0.45);
    await clickCentre(page, r.id);
    const p = (await layers(page))[r.id].properties;
    const [x, y, w, h] = ["frame.x", "frame.y", "frame.width", "frame.height"].map((k) => Number(p[k]));
    await setProps(page, r.id, { "transform.pin": `${x},${y},${x + w},${y},${x + w},${y + h},${x},${y + h}` });
    const overlay = page.getByTestId("corner-pin-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.getByRole("button")).toHaveCount(4);
    // the pin in the parent's px: a stored "rel:" pin is relative to the layer's own top left
    const pin = async () => {
      const q = (await layers(page))[r.id].properties;
      const raw = String(q["transform.pin"]);
      const n = raw.replace(/^rel:/, "").split(",").map(Number);
      return raw.startsWith("rel:") ? n.map((v, i) => v + Number(i % 2 === 0 ? q["frame.x"] : q["frame.y"])) : n;
    };
    const before = await pin();

    // drag the top right corner up and in: the far edge of a surface
    const handle = overlay.getByRole("button", { name: "Corner pin top right" });
    const b = (await handle.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2 - 30, { steps: 6 });
    await page.mouse.up();
    const after = await pin();
    expect(after[2], "the corner moved left").toBeLessThan(before[2]);
    expect(after[3], "and up").toBeLessThan(before[3]);
    expect([after[0], after[1], after[4], after[5], after[6], after[7]], "the other corners stayed").toEqual([before[0], before[1], before[4], before[5], before[6], before[7]]);
    await expect.poll(() => drawn(page, r.id).evaluate((e) => getComputedStyle(e).transform), "drawn in perspective").toMatch(/^matrix3d/);

    await page.locator("[data-stage=artboard]").hover();
    await page.keyboard.press("Control+z");
    await expect.poll(pin, "one undo step takes the whole drag back").toEqual(before);

    // a pinned layer is moved like any other: the drawing goes with it, and the pin with the drawing
    const drawnX = () => drawn(page, r.id).evaluate((e) => Math.round(e.getBoundingClientRect().x));
    const x0 = await drawnX();
    const hit = (await page.locator(`[data-testid="stage-element"][data-element-id="${r.id}"]`).boundingBox())!;
    await page.mouse.move(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await page.mouse.down();
    await page.mouse.move(hit.x + hit.width / 2 + 30, hit.y + hit.height / 2, { steps: 4 });
    await page.mouse.move(hit.x + hit.width / 2 + 60, hit.y + hit.height / 2, { steps: 4 });
    await page.mouse.up();
    await expect.poll(drawnX, "the drawing moved with the layer").toBeGreaterThan(x0 + 20);
    await page.keyboard.press("Control+z");

    // removing the pin puts it back to a plain layer
    await setProps(page, r.id, { "transform.pin": "" });
    await expect(overlay).toHaveCount(0);
    await expect.poll(() => drawn(page, r.id).evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  });
});

test.describe("saved projects", () => {
  test("a current project is left as it is: a sample layer the designer put in flow stays in flow", async ({ page }) => {
    await ready(page, { empty: false });
    await setProps(page, "headline", { positioning: "flow" });
    await waitSaved(page);
    await page.waitForTimeout(800);
    await waitSaved(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    await page.waitForTimeout(500);
    expect((await layers(page)).headline.properties.positioning).toBe("flow");
  });

  test("an emptied page stays empty after a reload", async ({ page }) => {
    await ready(page);
    await page.locator("[data-stage=artboard]").hover();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect.poll(async () => (await layers(page)) && (await count(page))).toBe(1);
    await waitSaved(page);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    await waitSaved(page);
    await page.waitForTimeout(500);
    expect(await count(page), "the sample did not come back").toBe(1);
  });

  test("a project saved with the page size in the wrong unit opens at the right size", async ({ page }) => {
    await ready(page, { empty: false });
    const root = Object.values(await layers(page)).find((l) => l.parentId === null)!;
    const width = Number(root.properties["frame.width"]);
    expect(width).toBeGreaterThan(100);
    await waitSaved(page);
    await page.waitForTimeout(800); // past the autosave debounce
    await waitSaved(page);
    // what older builds saved: 1440 stored as a percentage, a sample layer with no positioning, and an undo history
    await page.evaluate(async ({ rootId }) => {
      const id = new URL(location.href).searchParams.get("projectId")!;
      const db = await new Promise<IDBDatabase>((ok, no) => {
        const q = indexedDB.open("lazylayout");
        q.onsuccess = () => ok(q.result);
        q.onerror = () => no(q.error);
      });
      await new Promise<void>((ok, no) => {
        const tx = db.transaction(["projects"], "readwrite");
        const store = tx.objectStore("projects");
        const get = store.get(id);
        get.onsuccess = () => {
          const record = get.result;
          const found: Record<string, L> = record.snapshot.document?.layers ?? record.snapshot.layers;
          found[rootId].properties["frame.widthUnit"] = "%";
          found[rootId].properties["frame.heightUnit"] = "%";
          // the new editor saves only what the page holds in its snapshot: a sample layer may not be in it
          if (found.headline) delete found.headline.properties.positioning;
          store.put(record);
        };
        tx.oncomplete = () => ok();
        tx.onerror = () => no(tx.error);
      });
      db.close();
    }, { rootId: root.id });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.locator("[data-stage=artboard]")).toBeVisible();
    await expect.poll(async () => (await layers(page))[root.id].properties["frame.widthUnit"]).toBe("px");
    const after = await layers(page);
    expect(after[root.id].properties["frame.heightUnit"]).toBe("px");
    expect(after[root.id].properties["frame.width"]).toBe(width);
    expect(after.headline.properties.positioning, "the old sample layer can be moved again").toBe("absolute");
    const zoomed = (await page.locator("[data-stage=artboard]").boundingBox())!.width;
    await expect.poll(async () => Math.round((await drawn(page, root.id).boundingBox())!.width)).toBe(Math.round(zoomed));
  });
});

test.describe("menus", () => {
  test("a submenu opens at its full width, even when hovered again before it has finished opening", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    const box = (await hit(page, r.id).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    const layer = page.getByRole("menuitem", { name: /^Layer/ });
    await expect(layer).toBeVisible();
    // the test build opens a submenu on the first hover, so each of these asks again straight away
    for (let i = 0; i < 4; i++) await layer.hover();
    const sub = page.locator("[data-submenu]");
    await expect.poll(async () => Math.round((await sub.boundingBox())?.width ?? 0), "the submenu is as wide as its menu").toBeGreaterThan(200);
    await expect(sub.getByRole("menuitem", { name: /^Rename/ })).toBeVisible();
    expect((await sub.getByRole("menuitem", { name: /^Rename/ }).boundingBox())!.width, "its rows are as wide as the menu").toBeGreaterThan(150);
    await page.waitForTimeout(800); // the spring has settled
    expect(Math.round((await sub.boundingBox())!.width)).toBeGreaterThan(200);
  });
});

test.describe("menus, moving between submenus", () => {
  test("hovering another row with a submenu swaps the submenu to that row's items", async ({ page }) => {
    await ready(page);
    const r = await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    const box = (await hit(page, r.id).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
    const sub = page.locator("[data-submenu]");
    for (const [row, first] of [["Arrange", "Bring forward"], ["Layer", "Ungroup"], ["Arrange", "Bring forward"], ["More", ""]] as const) {
      const item = page.getByRole("menuitem", { name: new RegExp(`^${row}`) });
      const b = (await item.boundingBox())!;
      await page.mouse.move(b.x + 40, b.y + b.height / 2, { steps: 6 });
      await item.hover();
      await expect(sub, `${row}'s submenu is showing`).toHaveAttribute("aria-label", row);
      if (first) await expect(sub.getByRole("menuitem").first()).toContainText(first);
      await expect.poll(async () => Math.round((await sub.boundingBox())?.width ?? 0)).toBeGreaterThan(200);
    }
  });
});

test.describe("an empty page is empty", () => {
  test("the page is never drawn: no white sheet, border or title strip, with or without layers", async ({ page }) => {
    await ready(page);
    const board = page.locator("[data-stage=artboard]");
    const look = () => board.evaluate((e) => {
      const cs = getComputedStyle(e);
      const label = document.getElementById("albl");
      return { bg: cs.backgroundColor, shadow: cs.boxShadow, border: cs.borderTopColor, label: label ? getComputedStyle(label).visibility : "none" };
    });
    await expect.poll(look, "nothing drawn for an empty page").toMatchObject({ bg: "rgba(0, 0, 0, 0)", shadow: "none", label: "hidden" });
    await expect(page.getByText("Start with")).toBeVisible();
    await expect(board, "it is still there to draw on").toBeVisible();
    // what the engine draws for the page (its own white fill) is hidden too: no white pixel where the page is
    await expect.poll(() => page.locator('[data-testid="stage-page"]').evaluate((e) => getComputedStyle(e).visibility)).toBe("hidden");
    const shot = PNG.sync.read(await page.locator("[data-stage=artboard]").screenshot());
    const white = [...Array(shot.width * shot.height).keys()].filter((i) => shot.data[i * 4] > 250 && shot.data[i * 4 + 1] > 250 && shot.data[i * 4 + 2] > 250).length;
    expect(white / (shot.width * shot.height), "the canvas shows through where the page would be").toBeLessThan(0.02);
    const grey = (x: number, y: number) => shot.data.slice((y * shot.width + x) * 4, (y * shot.width + x) * 4 + 3).join(",");
    const strip = new Set<string>();
    for (let x = 4; x < shot.width - 4; x += 40) strip.add(grey(x, 3)); // where the title strip sat, along the top edge
    expect(strip.size, "no strip along the top edge: one flat colour").toBe(1);

    await rectangle(page, 0.2, 0.3, 0.3, 0.4);
    // the page is never drawn, even with a layer on it: the canvas shows through
    expect((await look()).bg).toBe("rgba(0, 0, 0, 0)");
    expect((await look()).label).toBe("visible");
    await expect(page.locator('[data-testid="stage-page"]')).toHaveCSS("visibility", "visible");
    await expect(page.getByText("Start with")).toHaveCount(0);

    // taking the last layer away empties it again
    await page.locator("[data-stage=artboard]").hover();
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Delete");
    await expect.poll(async () => (await look()).bg).toBe("rgba(0, 0, 0, 0)");
  });
});

test.describe("split text into letters", () => {
  test("one click turns a word into one layer per letter, in place, each controllable on its own", async ({ page }) => {
    await ready(page);
    await page.getByRole("button", { name: /^Text/ }).first().click();
    await drag(page, await art(page, 0.1, 0.2), await art(page, 0.5, 0.3));
    await page.keyboard.press("Escape");
    const [text] = await ofKind(page, "text");
    await setProps(page, text.id, { "content.text": "Porsche", "typography.fontSize": 80, "typography.fontWeight": 800, "typography.color": "#112233", "frame.width": 520, "frame.height": 120 });
    await page.waitForTimeout(500);
    const whole = (await drawn(page, text.id).boundingBox())!;

    await page.getByText(text.name, { exact: true }).first().click({ button: "right" });
    await page.waitForTimeout(300);
    await page.getByRole("menuitem", { name: /^Layer/ }).hover();
    await page.getByRole("menuitem", { name: /^Split into letters/ }).click();

    await expect.poll(async () => (await ofKind(page, "text")).length, "seven letters, no layer for the word").toBe(7);
    const letters = await ofKind(page, "text");
    expect(letters.map((l) => l.properties["content.text"]).join("")).toBe("Porsche");
    expect(letters.every((l) => l.properties["typography.color"] === "#112233" && l.properties["typography.fontSize"] === 80), "each keeps the look").toBe(true);
    const group = (await layers(page))[letters[0].parentId!];
    expect(group.name).toBe(`${text.name} letters`);

    // together they fill the place the word was
    await page.waitForTimeout(400);
    const boxes = await Promise.all(letters.map((l) => drawn(page, l.id).boundingBox()));
    const left = Math.min(...boxes.map((b) => b!.x));
    const right = Math.max(...boxes.map((b) => b!.x + b!.width));
    expect(Math.abs(left - whole.x), "starts where the word started").toBeLessThan(6);
    expect(right, "and ends no further than the word did").toBeLessThanOrEqual(whole.x + whole.width + 6);

    // one letter on its own: tilt the P
    const p = letters.find((l) => l.properties["content.text"] === "P")!;
    await setProps(page, p.id, { "frame.rotation": 20 });
    await expect.poll(() => drawn(page, p.id).evaluate((e) => getComputedStyle(e).transform)).not.toBe("none");
    const o = letters.find((l) => l.properties["content.text"] === "o")!;
    await expect.poll(() => drawn(page, o.id).evaluate((e) => getComputedStyle(e).transform), "the others stay straight").toBe("none");

    // one undo puts the word back
    await page.locator("[data-stage=artboard]").hover();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect.poll(async () => (await ofKind(page, "text")).length).toBe(1);
  });
});
