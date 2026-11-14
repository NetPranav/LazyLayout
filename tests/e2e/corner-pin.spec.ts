/**
 * Design track D16: corner pin. Four handles set an image, text or video onto a plane; the stored points are hit within 0.01 px
 * and the export matches within 0.5 px at five sizes.
 */
import { test, expect, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openEditor, pickShape } from "./support/editor";

type L = { id: string; properties: Record<string, unknown> };
const layers = (page: Page) =>
  page.evaluate(() => Object.fromEntries(Object.entries((window as unknown as { __LL_DOC__: { get: () => { layers: Record<string, L> } } }).__LL_DOC__.get().layers)));
test.use({ viewport: { width: 1600, height: 1000 } });

async function ready(page: Page) {
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
}
const parse = (text: string): [number, number][] => {
  const n = text.replace(/^rel:/, "").split(",").map(Number);
  return [[n[0], n[1]], [n[2], n[3]], [n[4], n[5]], [n[6], n[7]]];
};

test.describe("Corner pin (D16)", () => {
  test("dragging a handle moves that corner by exactly the drag, within 0.01 px, in one undo step", async ({ page }) => {
    await ready(page);
    const before = new Set(Object.keys(await layers(page)));
    await pickShape(page, "Rectangle");
    const b = (await page.locator("[data-stage=artboard]").boundingBox())!;
    await page.mouse.move(b.x + b.width * 0.2, b.y + b.height * 0.3);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5, { steps: 4 });
    await page.mouse.up();
    const id = Object.values(await layers(page)).find((l) => !before.has(l.id))!.id;

    await page.getByRole("button", { name: "More Position options", exact: true }).first().click();
    await page.getByRole("button", { name: "Pin corners", exact: true }).click();
    await expect(page.getByTestId("corner-pin-overlay")).toBeVisible();
    const stored = async () => parse(String((await layers(page))[id].properties["transform.pin"]));
    const start = await stored();

    const pageEl = page.locator('[data-testid="stage-page"]');
    const zoom = (await pageEl.boundingBox())!.width / (await pageEl.evaluate((e) => (e as HTMLElement).offsetWidth));
    const handle = page.getByRole("button", { name: "Corner pin top right", exact: true });
    const hb = (await handle.boundingBox())!;
    const [dx, dy] = [-60, 40]; // screen px
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(hb.x + hb.width / 2 + dx / 2, hb.y + hb.height / 2 + dy / 2, { steps: 4 });
    await page.mouse.move(hb.x + hb.width / 2 + dx, hb.y + hb.height / 2 + dy, { steps: 4 });
    await page.mouse.up();

    const after = await stored();
    expect(Math.abs(after[1][0] - (start[1][0] + dx / zoom))).toBeLessThan(0.01);
    expect(Math.abs(after[1][1] - (start[1][1] + dy / zoom))).toBeLessThan(0.01);
    for (const i of [0, 2, 3]) expect(after[i]).toEqual(start[i]); // the other three corners did not move

    await page.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
    await expect.poll(async () => (await stored())[1]).toEqual(start[1]); // the whole drag was one undo step
  });

  test("the export draws each pinned layer onto its four points within 0.5 px, at five sizes", async ({ page, browser }, testInfo) => {
    test.setTimeout(180_000);
    await ready(page);
    await page.getByText("Design", { exact: true }).click();
    await page.getByRole("menuitem", { name: /Desktop/i }).click();
    type Win = { __LL_DOC__: { get: () => { layers: Record<string, { id: string; archetype: string; parentId: string | null }> }; commands: { addLayer: (a: unknown) => string; updateProps: (id: string, p: Record<string, unknown>) => void } } };
    const SIZES: [number, number][] = [[40, 40], [160, 90], [320, 180], [640, 360], [900, 500]];
    // five layers, one per size, each laid onto a different perspective quad (a billboard seen from the side, a road, a tilted wall...)
    const made = await page.evaluate((sizes) => {
      const w = window as unknown as Win;
      const frame = Object.values(w.__LL_DOC__.get().layers).find((l) => l.archetype === "container" && l.parentId !== null)!.id;
      return sizes.map(([width, height], i) => {
        const x = 40 + i * 20, y = 40 + i * 30;
        const id = w.__LL_DOC__.commands.addLayer({ archetype: "rectangle", parentId: frame, name: `Pinned ${i}`, properties: { positioning: "absolute", "frame.x": x, "frame.y": y, "frame.width": width, "frame.height": height } });
        // a convex quad in the layer's own proportions (so it stays convex at every size), pushed further into perspective for each size
        const f = 0.5 + i * 0.25;
        const unit = [[0.15 * f, 0.1 * f], [1 - 0.05 * f, -0.1 * f], [1 + 0.1 * f, 1 - 0.15 * f], [-0.1 * f, 1 + 0.05 * f]];
        const quad = unit.map(([u, v]) => [Math.round((x + u * width) * 100) / 100, Math.round((y + v * height) * 100) / 100]);
        w.__LL_DOC__.commands.updateProps(id, { "transform.pin": quad.flat().join(",") });
        return { id, quad };
      });
    }, SIZES);

    const built = await page.evaluate(async () => {
      const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ warnings: string[]; files: { path: string; text?: string }[] }> } };
      return w.__LL_EXPORT__.build({ target: "html", styling: "css" });
    });
    const dir = testInfo.outputPath("export-pin");
    for (const f of built.files) {
      if (f.text === undefined) continue;
      mkdirSync(dirname(join(dir, f.path)), { recursive: true });
      writeFileSync(join(dir, f.path), f.text);
    }
    expect((built.files.find((f) => f.path === "styles.css")!.text!.match(/matrix3d/g) ?? []).length).toBeGreaterThanOrEqual(5);

    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const ex = await ctx.newPage();
    await ex.goto(`file://${join(dir, "index.html")}`);
    // the exported elements, in document order, are the five pinned layers (their class names carry the layer's name)
    const got = await ex.evaluate((sizes) => {
      const out: { corners: [number, number][] }[] = [];
      const els = Array.from(document.querySelectorAll<HTMLElement>("svg")).filter((e) => getComputedStyle(e).transform.startsWith("matrix3d"));
      for (const [w, h] of sizes) {
        const el = els.find((e) => Math.abs(parseFloat(e.getAttribute("width") ?? "0") - w) < 0.01 && Math.abs(parseFloat(e.getAttribute("height") ?? "0") - h) < 0.01);
        if (!el) { out.push({ corners: [] }); continue; }
        const m = new DOMMatrix(getComputedStyle(el).transform);
        const corners = ([[0, 0], [w, 0], [w, h], [0, h]] as [number, number][]).map(([x, y]) => {
          const p = m.transformPoint(new DOMPoint(x, y, 0, 1));
          const cs = getComputedStyle(el); // (an svg has no offsetLeft: its place is its left and top)
          return [parseFloat(cs.left) + p.x / p.w, parseFloat(cs.top) + p.y / p.w] as [number, number];
        });
        out.push({ corners });
      }
      return out;
    }, SIZES);
    made.forEach((m, i) => {
      expect(got[i].corners.length, `size ${SIZES[i]}: the exported element was found`).toBe(4);
      got[i].corners.forEach((c, k) => {
        const d = Math.hypot(c[0] - m.quad[k][0], c[1] - m.quad[k][1]);
        expect(d, `size ${SIZES[i]} corner ${k}: exported at ${c}, pinned to ${m.quad[k]}`).toBeLessThan(0.5);
      });
    });
    await ctx.close();
  });
});
