import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { BindingDraftSchema } from "../../document/signals";
import { RenderLayer } from "../RenderLayer";
import { styleWrites } from "../../engine/stage/styleWrites";
import { buildSiteExport } from "../../export/site";
import { frameIndex, scrubDraft, sequenceGrid, sequencePosition, sequenceSize } from "../sequence";

const props = (o: Record<string, unknown>) => (p: string) => o[p];
const SRC = "https://example.com/turn.jpg";
const sheet = (extra: Record<string, unknown> = {}): Layer =>
  createLayer({ id: "img", archetype: "image", parentId: "p", name: "Product", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 300, "frame.height": 200, "media.src": SRC, "sequence.cols": 5, "sequence.rows": 4, "sequence.frames": 18, ...extra } }) as Layer;

describe("image sequences (D13)", () => {
  it("is off without columns and rows, and counts frames from the grid, held to the cells", () => {
    assert.equal(sequenceGrid(props({})), null);
    assert.equal(sequenceGrid(props({ "sequence.cols": 4 })), null);
    assert.deepEqual(sequenceGrid(props({ "sequence.cols": 5, "sequence.rows": 4 })), { cols: 5, rows: 4, frames: 20 });
    assert.deepEqual(sequenceGrid(props({ "sequence.cols": 5, "sequence.rows": 4, "sequence.frames": 18 })), { cols: 5, rows: 4, frames: 18 });
    assert.equal(sequenceGrid(props({ "sequence.cols": 5, "sequence.rows": 4, "sequence.frames": 99 }))!.frames, 20);
  });

  it("every frame of a sheet lands on its own cell: left to right, top to bottom, the first and last at the corners", () => {
    const g = { cols: 5, rows: 4, frames: 18 };
    assert.equal(sequencePosition(g, 0), "0% 0%");
    assert.equal(sequencePosition(g, 4), "100% 0%");
    assert.equal(sequencePosition(g, 5), "0% 33.3333%");
    assert.equal(sequencePosition(g, 17), "50% 100%"); // frame 17 = row 3, column 2
    assert.equal(sequenceSize(g), "500% 400%");
    const seen = new Set<string>();
    for (let i = 0; i < g.frames; i++) seen.add(sequencePosition(g, i));
    assert.equal(seen.size, g.frames, "no two frames share a cell");
  });

  it("rounds to the nearest frame and holds at both ends", () => {
    const g = { cols: 5, rows: 4, frames: 18 };
    assert.equal(frameIndex(g, 2.4), 2);
    assert.equal(frameIndex(g, 2.6), 3);
    assert.equal(frameIndex(g, -5), 0);
    assert.equal(frameIndex(g, 400), 17);
    assert.equal(frameIndex(g, Number.NaN), 0);
  });

  it("the renderer draws one element with the sheet as its background, shifted to the frame, readable once as a picture", () => {
    const layer = sheet({ "sequence.frame": 7, "media.alt": "A watch turning" });
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "img", layers: { img: layer } }));
    assert.match(html, /role="img"/);
    assert.match(html, /aria-label="A watch turning"/);
    assert.match(html, /data-seq="5,4,18"/);
    assert.match(html, /background-size:500% 400%/);
    assert.match(html, /background-position:50% 33\.3333%/); // frame 7 = row 1, column 2
    assert.doesNotMatch(html, /<img /);
  });

  it("an ordinary picture is still an img", () => {
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "img", layers: { img: sheet({ "sequence.cols": 0, "sequence.rows": 0 }) } }));
    assert.match(html, /<img /);
  });

  it("the kernel's style write for an animated frame is the background position", () => {
    const resolved = { "sequence.cols": 5, "sequence.rows": 4, "sequence.frames": 18, "sequence.frame": 17.2 };
    assert.deepEqual(styleWrites(["sequence.frame"], resolved as never), { "background-position": "50% 100%" });
    assert.deepEqual(styleWrites(["sequence.frame"], { "sequence.frame": 3 } as never), {}); // not a sheet: nothing to move
  });

  it("the scrub driver is a valid binding that plays the whole sheet", () => {
    const d = BindingDraftSchema.parse(scrubDraft("img", "p", { cols: 5, rows: 4, frames: 18 }));
    assert.equal(d.target.kind === "property" && d.target.path, "sequence.frame");
    const remap = d.expr.operators[0] as { outMin: number; outMax: number };
    assert.deepEqual([remap.outMin, remap.outMax], [0, 17]);
  });

  it("the plain HTML export carries the grid and a script that moves the frame, with the sheet as the background", async () => {
    const page = { ...(createLayer({ id: "p", archetype: "container", parentId: null, name: "Home", children: ["img"], properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 3000, "appearance.background.color": "#ffffff" } }) as Layer), page: { route: "/" } };
    const doc = createDocumentFromLayers([page, sheet()]);
    doc.bindings = { b1: { id: "b1", ownerLayerId: "img", enabled: true, name: "Scrub frames", ...scrubDraft("img", "p", { cols: 5, rows: 4, frames: 18 }) } as never };
    const r = await buildSiteExport(doc, { target: "html", styling: "css" });
    const html = String(r.files.find((f) => f.path === "index.html")!.content);
    const css = String(r.files.find((f) => f.path === "styles.css")!.content);
    assert.match(html, /data-seq="5,4,18"/);
    assert.match(css, /background-size: 500% 400%/);
    assert.match(css, /background-image: url\(/);
    const script = r.files.filter((f) => /\.js$/.test(f.path)).map((f) => String(f.content)).join("\n");
    assert.match(script, /sequence\.frame/);
    assert.match(script, /data-seq/);
    assert.equal(r.warnings.some((w) => /sequence\.frame cannot be driven/.test(w)), false);
  });
});
