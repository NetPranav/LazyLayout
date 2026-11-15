/**
 * ROADMAP Phase 125: text in shapes and typography depth. For 5 shapes (circle, triangle, hexagon, diamond, pill) and
 * 3 fonts, the lines the browser breaks match the reference: each line gets the span the shape leaves it (worked out
 * from the outline by our own geometry), and words go on a line while it fits (each line's width measured with a
 * canvas in the same font). Also: pour text into a shape from the inspector; OpenType features, the stylistic set and
 * an axis from the Type details section; styled ranges kept after editing in place; columns.
 */
import { test, expect, type Page } from "@playwright/test";
import { openEditor } from "./support/editor";
import { bandOf, parseTextShape, shapeFloats, shapeRows } from "../../src/core/text/textShape";

type L = { id: string; archetype: string; parentId: string | null; properties: Record<string, unknown> };
type Doc = { get: () => { layers: Record<string, L> }; commands: { addLayer: (o: unknown) => string; removeLayer: (id: string) => void } };

test.use({ viewport: { width: 1600, height: 1000 } });

const W = 300;
const H = 300;
const SIZE = 16;
const LH = 24;
const SHAPES = [
  { name: "circle", d: "M150 0 A150 150 0 1 1 149.99 0 Z" },
  { name: "triangle", d: "M150 0 L300 300 L0 300 Z" },
  { name: "hexagon", d: "M75 0 L225 0 L300 150 L225 300 L75 300 L0 150 Z" },
  { name: "diamond", d: "M150 0 L300 150 L150 300 L0 150 Z" },
  { name: "pill", d: "M60 0 L240 0 A60 60 0 0 1 300 60 L300 240 A60 60 0 0 1 240 300 L60 300 A60 60 0 0 1 0 240 L0 60 A60 60 0 0 1 60 0 Z" },
];
const FONTS = ["Arial, Helvetica, sans-serif", "Georgia, 'Times New Roman', serif", "'Courier New', Courier, monospace"];
const WORDS = "Type can follow any outline you draw so a short paragraph sits neatly inside a circle a triangle or a hexagon and every line starts and ends where the shape says it should with no hand placed breaks at all and the words keep flowing as you edit them".split(" ");
const INSET = 6;

/** Where each line of the text sits and how wide it may be, from our own geometry. */
function spans(d: string) {
  const shape = parseTextShape(JSON.stringify({ d, inset: INSET }))!;
  const rows = shapeRows(shape, W, H);
  const { top } = shapeFloats(rows, W, H, LH, 6 * SIZE);
  const out: { l: number; r: number }[] = [];
  for (let y = top; y + LH <= H; y += LH) out.push(bandOf(rows, y, y + LH));
  return out;
}

/** The lines the browser drew in a text layer: its words, grouped by the top of the line each sits on, and that top (in the layer's own px). */
async function drawnLines(page: Page, id: string): Promise<{ words: string[]; top: number }[]> {
  return page.evaluate((id) => {
    const el = document.querySelector(`[data-stage=artboard] [data-element-id="${id}"][data-archetype="text"]`) as HTMLElement;
    const box = el.getBoundingClientRect();
    const scale = box.width / el.offsetWidth;
    const lines = new Map<number, string[]>();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.nodeValue ?? "";
      for (const m of text.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(node, m.index!);
        r.setEnd(node, m.index! + m[0].length);
        const top = Math.round(r.getClientRects()[0].top);
        const key = [...lines.keys()].find((k) => Math.abs(k - top) <= 3) ?? top;
        lines.set(key, [...(lines.get(key) ?? []), m[0]]);
      }
    }
    return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([top, words]) => ({ words, top: (top - box.top) / scale }));
  }, id);
}

/**
 * The reference lines: words go on a line while the line (measured in the text's font) fits its span. When a line
 * can't take even its first word the shape is full: the rest runs on below it (where the box clips it).
 */
async function referenceLines(page: Page, id: string, widths: number[], words: string[]): Promise<string[][]> {
  return page.evaluate(({ id, widths, words }) => {
    const el = document.querySelector(`[data-stage=artboard] [data-element-id="${id}"][data-archetype="text"]`)!;
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    // browsers lay out in units of 1/64 px: a line that overshoots its span by less than one still fits (Courier's
    // "every line" is 96.0156 px, a diamond's line 96 px)
    const UNIT = 1 / 64;
    const lines: string[][] = [];
    let i = 0;
    for (const w of widths) {
      if (i >= words.length || ctx.measureText(words[i]).width > w + UNIT) break;
      const line = [words[i++]];
      while (i < words.length && ctx.measureText([...line, words[i]].join(" ")).width <= w + UNIT) line.push(words[i++]);
      lines.push(line);
    }
    return lines;
  }, { id, widths, words });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => ((window as unknown as { __LL_TEST__: boolean }).__LL_TEST__ = true));
  await openEditor(page);
  await expect(page.locator("[data-stage=artboard]")).toBeVisible();
});

test("line breaks match the reference for 5 shapes and 3 fonts", async ({ page }) => {
  const cases = SHAPES.flatMap((s) => FONTS.map((font) => ({ shape: s, font })));
  const ids = await page.evaluate(({ cases, W, H, SIZE, LH, INSET, text }) => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    for (const c of [...(doc.get().layers[frame.id] as unknown as { children: string[] }).children]) doc.commands.removeLayer(c);
    return cases.map((c, i) =>
      doc.commands.addLayer({
        archetype: "text",
        parentId: frame.id,
        properties: {
          positioning: "absolute", "frame.x": 10 + (i % 5) * 310, "frame.y": 10 + Math.floor(i / 5) * 310, "frame.width": W, "frame.height": H, "text.sizing": "fixed",
          "content.text": text, "typography.fontSize": SIZE, "typography.lineHeight": LH, "typography.lineHeightUnit": "px", "typography.fontFamily": c.font,
          "text.shape": JSON.stringify({ d: c.shape.d, inset: INSET }),
        },
      }),
    );
  }, { cases, W, H, SIZE, LH, INSET, text: WORDS.join(" ") });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const failures: string[] = [];
  let lines = 0;
  for (const [i, c] of cases.entries()) {
    const sp = spans(c.shape.d);
    const drawn = await drawnLines(page, ids[i]);
    const want = await referenceLines(page, ids[i], sp.map((s) => s.r - s.l), WORDS);
    lines += drawn.length;
    const a = drawn.map((l) => l.words.join(" "));
    const b = want.map((l) => l.join(" "));
    if (b.length < 4) failures.push(`${c.shape.name} / ${c.font}: only ${b.length} lines fit`);
    // every line inside the shape as the reference has it, and what didn't fit below the shape
    for (let k = 0; k < b.length; k++) if (a[k] !== b[k]) failures.push(`${c.shape.name} / ${c.font.split(",")[0]}, line ${k + 1}: drawn "${a[k]}" but the reference has "${b[k]}"`);
    for (const l of drawn.slice(b.length)) if (l.top < H - LH) failures.push(`${c.shape.name} / ${c.font.split(",")[0]}: "${l.words.join(" ")}" didn't fit but sits inside the shape (top ${l.top.toFixed(1)})`);
  }
  console.log(`text in shapes: 15 cases, ${lines} lines compared`);
  expect(failures).toEqual([]);
});

test("pour text into a shape; OpenType, stylistic set and an axis; styled ranges kept; columns", async ({ page }) => {
  const ids = await page.evaluate(() => {
    const doc = (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__;
    const frame = Object.values(doc.get().layers).find((l) => l.parentId && doc.get().layers[l.parentId]?.parentId === null && l.archetype === "container")!;
    const circle = doc.commands.addLayer({ archetype: "ellipse", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 100, "frame.y": 100, "frame.width": 260, "frame.height": 260, "svg.fill": "#e2e8f0" } });
    const text = doc.commands.addLayer({ archetype: "text", parentId: frame.id, properties: { positioning: "absolute", "frame.x": 500, "frame.y": 100, "frame.width": 240, "content.text": "A paragraph that wraps inside a circle, with true small caps and figures 1/2 0123", "typography.fontSize": 16 } });
    return { circle, text };
  });
  const props = () => page.evaluate((id) => (window as unknown as { __LL_DOC__: Doc }).__LL_DOC__.get().layers[id].properties, ids.text);
  const textEl = page.locator(`[data-stage=artboard] [data-element-id="${ids.text}"][data-archetype="text"]`);

  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), ids.text);
  const cb = (await page.locator(`[data-stage=artboard] [data-element-id="${ids.circle}"]`).first().boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.keyboard.up("Shift");
  await page.getByRole("button", { name: "Fill shape with text" }).click();
  await expect.poll(async () => String((await props())["text.shape"] ?? "")).toContain('"inset":8');
  await expect(textEl.locator("[data-text-shape-float]")).toHaveCount(2);
  expect(await textEl.evaluate((e) => getComputedStyle(e.querySelector('[data-text-shape-float="left"]')!).shapeOutside)).toContain("polygon(");

  // typography depth on the text alone
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), ids.text);
  await page.getByRole("checkbox", { name: "Tabular numbers" }).click();
  await page.getByRole("checkbox", { name: "Ligatures", exact: true }).click();
  await page.getByRole("checkbox", { name: "Small caps" }).click();
  await page.getByRole("combobox", { name: "Stylistic set" }).click();
  await page.getByRole("option", { name: "Set 3", exact: true }).click();
  await expect.poll(async () => JSON.parse(String((await props())["typography.fontFeatures"] ?? "{}"))).toEqual({ tnum: true, liga: false, ss03: true });
  const style = await textEl.evaluate((e) => ({ ff: getComputedStyle(e).fontFeatureSettings, caps: getComputedStyle(e).fontVariantCaps }));
  expect(style.ff).toContain('"tnum"');
  expect(style.ff).toContain('"liga" 0');
  expect(style.caps).toBe("small-caps");
  // the weight axis on the canvas
  await page.getByRole("switch", { name: "Font axes on canvas" }).click();
  const bar = page.getByRole("toolbar", { name: "Font axes" });
  await expect(bar).toBeVisible();
  const thumb = bar.getByRole("slider", { name: "Canvas font axis Weight" });
  await thumb.focus();
  await page.keyboard.press("End");
  await expect.poll(async () => [(await props())["typography.fontWeight"], (await props())["typography.fontVariations"]]).toEqual(["900", "wght 1000"]);

  // styled ranges survive editing in place
  await page.getByRole("button", { name: "Take out of shape" }).click();
  await page.locator(`[data-stage=artboard] [data-element-id="${ids.text}"]`).last().dblclick({ force: true });
  const editor = page.getByTestId("stage-text-editor");
  await expect(editor).toBeVisible();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Bold then plain");
  await page.keyboard.press("Home");
  await page.keyboard.down("Shift");
  for (let k = 0; k < 4; k++) await page.keyboard.press("ArrowRight");
  await page.keyboard.up("Shift");
  await page.keyboard.press("Control+b");
  await page.keyboard.press("Escape");
  await expect.poll(async () => JSON.parse(String((await props())["content.runs"] ?? "[]"))).toEqual([{ t: "Bold", b: 1 }, { t: " then plain" }]); // (runs are stored compactly)
  expect((await props())["content.text"]).toBe("Bold then plain");

  // columns
  await page.evaluate((id) => (window as unknown as { __LL_SELECT__: (id: string) => void }).__LL_SELECT__(id), ids.text);
  await page.getByLabel("Text columns").fill("2");
  await page.getByLabel("Text columns").press("Enter");
  await expect.poll(() => textEl.evaluate((e) => getComputedStyle(e).columnCount)).toBe("2");
});
