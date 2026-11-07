/**
 * The canvas drawn through the engine: what is on it is the real tree, so an edit to any layer (a sample one too) shows,
 * a frame's visibility, opacity and clip reach its children, auto layout really lays out, each shortcut fires once, an
 * emptied page stays empty, and a project saved by an older build opens at the right page size. Also the gestures the
 * rewrite touched: marquee, Shift-click and Alt-drag.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor, waitSaved } from "./support/editor";

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
  await page.getByRole("button", { name: "Shape", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Rectangle/ }).click();
  await drag(page, await art(page, x1, y1), await art(page, x2, y2));
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
    await page.getByRole("radio", { name: "Stack layout" }).click();
    await page.getByRole("radio", { name: "Horizontal direction" }).click();
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

  test("Insert > Sections adds a real section to the page on screen", async ({ page }) => {
    await ready(page);
    const before = await count(page);
    await page.getByRole("button", { name: /Insert/ }).first().click();
    await page.getByText("Sections", { exact: true }).first().click();
    await page.getByText("Hero split", { exact: true }).first().click();
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
          delete found.headline.properties.positioning;
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
