/**
 * ROADMAP Phase 124: text on a path. Five fixtures (an open arc, a circle starting a quarter round and centred, a wave
 * with letter spacing, a line ending at its end, and an arc on its other side) place every glyph within 0.5 px of
 * the reference, and the exported site places them the same. The reference is worked out apart from the browser's
 * text-on-path layout, by SVG's rule: each glyph's midpoint sits on the path at the start plus the width of the text
 * before it plus half its own (widths measured with a canvas), the glyph turned to the path's direction there; the
 * points and directions come from our own path geometry.
 *
 * Also: put on a path from the inspector, the start dragged on the canvas, the words edited in place, and the start
 * animated by keyframes.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";
import { pathDataToBez } from "../../src/core/paths/bezBridge";
import { polylines } from "../../src/core/geometry/measure";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void; updateProps: (id: string, p: unknown) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const FIXTURES = [
  { name: "open arc", d: "M10 150 Q150 0 290 150", start: 0, align: "left", ls: 0, flip: false, text: "Along the arc we go" },
  { name: "circle, centred at a quarter", d: "M150 30 A120 120 0 1 1 149.99 30 Z", start: 0.25, align: "center", ls: 0, flip: false, text: "ROUND AND ROUND" },
  { name: "wave with spacing", d: "M10 100 C60 20 110 180 160 100 S260 20 290 100", start: 0.05, align: "left", ls: 3, flip: false, text: "wavy words" },
  { name: "line, ending at its end", d: "M10 120 L290 60", start: 1, align: "right", ls: 0, flip: false, text: "ends here" },
  { name: "arc, other side", d: "M10 60 Q150 200 290 60", start: 0.1, align: "left", ls: 1, flip: true, text: "Underneath it" },
];

/** The path the text runs along (reversed for the other side), as our own geometry measures it. */
function line(d: string, flip: boolean) {
  const bez = pathDataToBez(d)!;
  return polylines(flip ? bez.reverseSubpaths() : bez)!.find((l) => l.length() > 1e-6)!;
}

/** Each glyph's start: (x, y) in the layer's own space, and the width of each prefix (from a canvas in `page`). */
async function glyphs(pg: Page, root: string) {
  return pg.evaluate((root) => {
    const svgs = [...document.querySelectorAll<SVGSVGElement>(`${root} svg[data-text-path]`)];
    return svgs.map((svg) => {
      const text = svg.querySelector("text") as SVGTextElement;
      const n = text.getNumberOfChars();
      const starts = Array.from({ length: n }, (_, i) => {
        const p = text.getStartPositionOfChar(i);
        return { x: p.x, y: p.y };
      });
      const cs = getComputedStyle(text);
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const content = text.textContent ?? "";
      const prefix = Array.from({ length: content.length + 1 }, (_, i) => ctx.measureText(content.slice(0, i)).width);
      return { starts, prefix, content, w: svg.width.baseVal.value, h: svg.height.baseVal.value };
    });
  }, root);
}

test("five fixtures place every glyph within 0.5 px of the reference; the export places them the same", async ({ page, browser }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
  await page.evaluate((fx) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
    fx.forEach((f, i) =>
      doc.commands.addLayer({
        archetype: "text",
        parentId: frame.id,
        properties: {
          positioning: "absolute", "frame.x": 20 + (i % 3) * 320, "frame.y": 20 + Math.floor(i / 3) * 320, "frame.width": 300, "frame.height": 300 + i, "text.sizing": "fixed",
          "content.text": f.text, "typography.fontSize": 22, "typography.fontFamily": "Arial, Helvetica, sans-serif", "typography.textAlign": f.align, "typography.letterSpacing": f.ls,
          "typography.textPath": JSON.stringify({ d: f.d, start: f.start, flip: f.flip }), "typography.textPathStart": f.start * 100,
        },
      }),
    );
  }, FIXTURES);
  await page.waitForTimeout(300);
  const stage = (await glyphs(page, "[data-stage=artboard]")).sort((a, b) => a.h - b.h);
  expect(stage).toHaveLength(5);

  const failures: string[] = [];
  let worst = 0;
  stage.forEach((g, i) => {
    const f = FIXTURES[i];
    expect(g.content).toBe(f.text);
    const l = line(f.d, f.flip);
    const total = g.prefix[g.prefix.length - 1] + f.ls * f.text.length;
    const shift = f.align === "center" ? -total / 2 : f.align === "right" ? -total : 0;
    g.starts.forEach((s, k) => {
      // SVG's rule: a glyph's midpoint (half its advance, letter spacing included) sits on the path at its distance, and
      // the glyph turns to the path's direction there, so its start is half an advance back along that direction
      const adv = g.prefix[k + 1] - g.prefix[k] + f.ls;
      const mid = f.start * l.length() + shift + g.prefix[k] + f.ls * k + adv / 2;
      const at = l.at(mid / l.length())!;
      const dir = { x: at.normal.y, y: -at.normal.x };
      const p = { x: at.point.x - (dir.x * adv) / 2, y: at.point.y - (dir.y * adv) / 2 };
      const off = Math.hypot(p.x - s.x, p.y - s.y);
      worst = Math.max(worst, off);
      if (off > 0.5) failures.push(`${f.name}, glyph ${k} "${f.text[k]}": ${off.toFixed(2)} px off`);
    });
  });
  console.log(`text on path: worst glyph ${worst.toFixed(3)} px from the reference`);
  expect(failures).toEqual([]);

  // the export places them the same
  const files = await page.evaluate(async () => {
    const w = window as unknown as { __LL_EXPORT__: { build: (o: unknown) => Promise<{ files: { path: string; text?: string }[] }> } };
    return (await w.__LL_EXPORT__.build({ target: "html", styling: "css" })).files.map((f) => ({ path: f.path, text: f.text ?? "" }));
  });
  const site = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await site.route("http://export.test/**", (route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\//, "") || "index.html";
    const f = files.find((x) => x.path === path || x.path.endsWith("/" + path));
    return f ? route.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : "text/html", body: f.text }) : route.fulfill({ status: 404, body: "" });
  });
  await site.goto(`http://export.test/${files.find((f) => f.path.endsWith("index.html"))!.path}`);
  await site.waitForTimeout(300);
  const exported = (await glyphs(site, "body")).sort((a, b) => a.h - b.h);
  expect(exported).toHaveLength(5);
  exported.forEach((g, i) => {
    expect(g.content).toBe(FIXTURES[i].text);
    g.starts.forEach((s, k) => expect(Math.hypot(s.x - stage[i].starts[k].x, s.y - stage[i].starts[k].y), `${FIXTURES[i].name} glyph ${k}`).toBeLessThanOrEqual(0.5));
  });
  await site.close();
});

test("put on a path from the inspector, start dragged on the canvas, words edited in place, start animated", async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  const ids = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const circle = doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 200, "frame.y": 150, "frame.width": 240, "frame.height": 240, "svg.fill": "#e2e8f0" } });
    const text = doc.commands.addLayer({ archetype: "text", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 600, "frame.y": 150, "content.text": "Logo around", "typography.fontSize": 24 } });
    return { circle, text };
  });
  const props = () => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, ids.text);
  await page.evaluate(({ text, circle }) => {
    const w = window as unknown as { __LL_SELECT__: (id: string) => void };
    w.__LL_SELECT__(text);
    (window as unknown as { __LL_SELECTION_ADD__?: (id: string) => void }).__LL_SELECTION_ADD__?.(circle);
  }, ids);
  // shift-click the circle too
  const circleBox = (await page.locator(`[data-stage=artboard] [data-element-id="${ids.circle}"]`).first().boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.click(circleBox.x + circleBox.width / 2, circleBox.y + circleBox.height / 2);
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Put on path" }).click();
  await expect.poll(async () => String((await props())["typography.textPath"] ?? "")).toContain('"d"');
  await expect(page.locator(`[data-stage=artboard] svg[data-text-path][data-element-id="${ids.text}"]`)).toBeVisible();

  // drag the start handle a quarter of the way round
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), ids.text);
  const h = page.locator("[data-text-path-handle]");
  await expect(h).toBeVisible();
  const hb = (await h.boundingBox())!;
  const tb = (await page.locator(`[data-stage=artboard] svg[data-text-path][data-element-id="${ids.text}"]`).boundingBox())!;
  const cx = tb.x + tb.width / 2;
  const cy = tb.y + tb.height / 2;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  // to the point a quarter turn on (the ellipse runs clockwise on screen)
  const ang = Math.atan2(hb.y + hb.height / 2 - cy, hb.x + hb.width / 2 - cx) + Math.PI / 2;
  await page.mouse.move(cx + Math.cos(ang) * tb.width / 2, cy + Math.sin(ang) * tb.height / 2, { steps: 6 });
  await page.mouse.up();
  const moved = Number((await props())["typography.textPathStart"]);
  expect(moved).toBeGreaterThan(18);
  expect(moved).toBeLessThan(32);

  // edit the words in place: the curve shows them as they are typed
  await page.locator(`[data-stage=artboard] [data-element-id="${ids.text}"]`).last().dblclick({ force: true });
  const editor = page.getByTestId("stage-text-editor");
  await expect(editor).toBeVisible();
  await page.keyboard.type("Brand mark");
  await expect(page.locator(`[data-stage=artboard] svg[data-text-path][data-element-id="${ids.text}"] textPath`)).toHaveText("Brand mark");
  await page.keyboard.press("Escape");
  await expect.poll(async () => (await props())["content.text"]).toBe("Brand mark");

  // the start as the motion engine writes it (a CSS variable): the text follows, and goes back when it's gone
  const tp = page.locator(`[data-stage=artboard] svg[data-text-path][data-element-id="${ids.text}"] textPath`);
  await page.evaluate((id) => document.querySelector<SVGSVGElement>(`[data-stage=artboard] svg[data-text-path][data-element-id="${id}"]`)!.style.setProperty("--ll-text-path-start", "60"), ids.text);
  await expect(tp).toHaveAttribute("startOffset", "60%");
  await page.evaluate((id) => document.querySelector<SVGSVGElement>(`[data-stage=artboard] svg[data-text-path][data-element-id="${id}"]`)!.style.removeProperty("--ll-text-path-start"), ids.text);
  await expect(tp).toHaveAttribute("startOffset", `${moved}%`);
});
