/**
 * ROADMAP Phase 122: image adjustments and filters. A look (curve, gradient map / duotone, sharpen, blur) is kept with
 * the picture and drawn as one SVG filter after FigCraft's seven adjustments; "show original" draws none of it and
 * keeps it all; the picture's file is never changed; the per-pixel reference follows the filter step by step.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { RenderLayer } from "../../render/RenderLayer";
import { parseFills, serializeFills, hasImageFilter } from "../paints";
import { NO_ADJUSTMENTS } from "../color";
import { CURVE_INPUTS, curveTable, imageFilterPrimitives, lookPreset, mapTables, referenceImage, sanitizeLook, throughTable } from "../imageLook";
import { imageEditFor, setImageEdit } from "../../editing/imageEditOps";

const PIC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const DUO = { map: [{ at: 0, color: "#1b1464" }, { at: 1, color: "#ff5c8a" }] };

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["img", "card"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "img", archetype: "image", parentId: "pg", name: "Photo", properties: { positioning: "absolute", "frame.width": 200, "frame.height": 150, "media.src": PIC } }) as Layer,
      createLayer({ id: "card", archetype: "rectangle", parentId: "pg", name: "Card", properties: { positioning: "absolute", "frame.width": 200, "frame.height": 150, "paint.fills": JSON.stringify([{ type: "image", src: PIC, mode: "fill" }]) } }) as Layer,
    ]),
  ),
);

describe("Phase 122: the look", () => {
  it("a straight curve is no curve; the curve's table passes through its five points and never overshoots", () => {
    assert.deepEqual(sanitizeLook({ curve: [...CURVE_INPUTS] }), {});
    const t = curveTable([0, 0.18, 0.5, 0.82, 1]);
    assert.equal(t.length, 33);
    for (const [i, x] of CURVE_INPUTS.entries()) assert.ok(Math.abs(throughTable(t, x) - [0, 0.18, 0.5, 0.82, 1][i]) < 1e-3);
    assert.ok(t.every((v, i) => i === 0 || v >= t[i - 1]), "monotone");
  });

  it("a duotone maps black to its dark colour and white to its light one", () => {
    const [r, g, b] = mapTables(DUO.map);
    assert.deepEqual([r[0], g[0], b[0]].map((v) => Math.round(v * 255)), [0x1b, 0x14, 0x64]);
    assert.deepEqual([r[32], g[32], b[32]].map((v) => Math.round(v * 255)), [0xff, 0x5c, 0x8a]);
    const src = Uint8ClampedArray.from([0, 0, 0, 255, 255, 255, 255, 255]);
    const out = referenceImage(src, 2, 1, null, DUO);
    assert.deepEqual([...out], [0x1b, 0x14, 0x64, 255, 0xff, 0x5c, 0x8a, 255]);
    assert.deepEqual([...src], [0, 0, 0, 255, 255, 255, 255, 255], "the source pixels are not changed");
  });

  it("the filter's steps in order; show original draws none of them", () => {
    const steps = imageFilterPrimitives({ ...NO_ADJUSTMENTS, exposure: 0.2, shadows: 0.3 }, { curve: [0, 0.2, 0.5, 0.8, 1], ...DUO, sharpen: 0.5, blur: 2 });
    assert.deepEqual(steps.map((s) => s.tag), ["feColorMatrix", "feComponentTransfer", "feComponentTransfer", "feColorMatrix", "feComponentTransfer", "feConvolveMatrix", "feGaussianBlur"]);
    assert.deepEqual(imageFilterPrimitives({ ...NO_ADJUSTMENTS, exposure: 0.2 }, { ...DUO, bypass: true }), []);
    assert.ok(lookPreset("Duotone: night")?.map);
  });

  it("sharpen raises an edge's contrast and blur softens it, in the reference", () => {
    const row = [0, 0, 0, 255, 0, 0, 0, 255, 200, 200, 200, 255, 200, 200, 200, 255];
    const src = Uint8ClampedArray.from([...row, ...row, ...row]);
    const sharp = referenceImage(src, 4, 3, null, { sharpen: 1 });
    assert.ok(sharp[(4 + 2) * 4] > 200 && sharp[(4 + 1) * 4] === 0, "the light side of the edge lighter, the dark side clamped at black");
    const soft = referenceImage(src, 4, 3, null, { blur: 1 });
    assert.ok(soft[(4 + 1) * 4] > 20 && soft[(4 + 2) * 4] < 180);
  });
});

describe("Phase 122: on image layers and image fills", () => {
  it("an image layer draws through the filter after its plain filters; show original draws the picture as it is", () => {
    assert.equal(setImageEdit(["img"], { adjust: { contrast: 0.2 }, look: DUO }), 1);
    const draw = () => renderToStaticMarkup(createElement(RenderLayer, { layerId: "img", layers: getDocument().layers }));
    const html = draw();
    assert.match(html, /<filter id="img__image"[^>]*>[\s\S]*feColorMatrix[\s\S]*feComponentTransfer/);
    assert.match(html, /filter:[^;"]*url\(#img__image\)/);
    assert.equal(getDocument().layers.img.properties["media.src"], PIC, "the file is never changed");

    setImageEdit(["img"], { look: { ...DUO, bypass: true } });
    const original = draw();
    assert.doesNotMatch(original, /<filter id="img__image"/);
    assert.match(original, /filter:none/);
    assert.deepEqual(imageEditFor("img").look, { ...DUO, bypass: true }, "and the duotone is still there");
    assert.equal(imageEditFor("img").adjust?.contrast, 0.2);
  });

  it("an image fill keeps its look through save and load, and switches back to the original", () => {
    setImageEdit(["card"], { look: { curve: [0, 0.18, 0.5, 0.82, 1], sharpen: 0.4 } });
    const fills = parseFills(getDocument().layers.card.properties["paint.fills"])!;
    assert.deepEqual(parseFills(serializeFills(fills)), fills);
    assert.ok(hasImageFilter(fills[0]));
    assert.equal(fills[0].type === "image" && fills[0].src, PIC);
    setImageEdit(["card"], { look: { ...imageEditFor("card").look, bypass: true } });
    assert.equal(hasImageFilter(parseFills(getDocument().layers.card.properties["paint.fills"])![0]), false);
    setImageEdit(["card"], { adjust: null, look: null });
    const plain = parseFills(getDocument().layers.card.properties["paint.fills"])![0];
    assert.equal(plain.type === "image" && (plain.look ?? plain.adjust ?? null), null);
  });
});
