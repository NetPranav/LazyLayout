/**
 * ROADMAP Phase 113: a blend mode and a mask per fill. The masks are read safely and round-trip; a shape draws each
 * masked fill inside an SVG alpha mask (wrapped in its blend), the stage and the export from the same definition.
 * The pixels are checked in the browser (`tests/e2e/fill-masks.spec.ts`).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { parseFills, serializeFills } from "../../paint/paints";
import { RenderLayer } from "../RenderLayer";
import { fadeAt } from "../shapePaint";

const fills = (top: Record<string, unknown>): string =>
  JSON.stringify([{ type: "solid", color: "#0000ff", ...top }, { type: "solid", color: "#ff0000" }]);
const rect = (id: string, fillsJson: string, x = 0): Layer =>
  createLayer({ id, archetype: "rectangle", parentId: "pg", name: id, properties: { positioning: "absolute", "frame.x": x, "frame.y": 0, "frame.width": 200, "frame.height": 100, "paint.fills": fillsJson } }) as Layer;
const page = (kids: Layer[]): Layer => createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: kids.map((k) => k.id), properties: { "frame.width": 800, "frame.height": 600 } }) as Layer;
const draw = (layers: Layer[], id: string) => renderToStaticMarkup(createElement(RenderLayer, { layerId: id, layers: Object.fromEntries(layers.map((l) => [l.id, l])) }));

describe("Phase 113: masks are stored safely", () => {
  it("every kind round-trips, and junk is dropped", () => {
    const list = [
      { type: "solid", color: "#000000", mask: { type: "linear", start: 0.2, end: 0.9, angle: 90 } },
      { type: "solid", color: "#000000", mask: { type: "radial", start: 0, end: 1, angle: 0 } },
      { type: "solid", color: "#000000", mask: { type: "conic", start: 1, end: 0, angle: 45 } },
      { type: "solid", color: "#000000", mask: { type: "layer", id: "e", invert: true }, blend: "multiply" },
      { type: "solid", color: "#000000", mask: { type: "spiral" } },
      { type: "solid", color: "#000000", mask: { type: "linear", start: 7, end: -3, angle: "x" } },
    ];
    const parsed = parseFills(JSON.stringify(list))!;
    assert.deepEqual(parsed[0].mask, { type: "linear", start: 0.2, end: 0.9, angle: 90 });
    assert.deepEqual(parsed[3].mask, { type: "layer", id: "e", invert: true });
    assert.equal(parsed[3].blend, "multiply");
    assert.equal(parsed[4].mask, undefined, "an unknown kind is no mask");
    assert.deepEqual(parsed[5].mask, { type: "linear", start: 1, end: 0, angle: 0 }, "clamped");
    assert.deepEqual(parseFills(serializeFills(parsed)), parsed);
  });
});

describe("Phase 113: a shape draws a masked fill in an alpha mask", () => {
  for (const mask of [
    { type: "linear", start: 0, end: 1, angle: 0 },
    { type: "radial", start: 0.2, end: 0.8, angle: 0 },
    { type: "conic", start: 0, end: 1, angle: 0 },
  ]) {
    it(`${mask.type} fade`, () => {
      const html = draw([page([rect("r", fills({ mask, blend: "screen" }))]), rect("r", fills({ mask, blend: "screen" }))], "r");
      assert.match(html, /<mask id="r__f0__mask"[^>]*mask-type:alpha/);
      assert.match(html, /mix-blend-mode:screen[^>]*><g mask="url\(#r__f0__mask\)">/, "the blend wraps the masked fill");
      assert.equal((html.match(/<mask /g) ?? []).length, 1, "only the masked fill has a mask");
    });
  }

  it("a sibling layer's outline as the mask, inside or outside; a layer that isn't a sibling leaves the fill unmasked", () => {
    const ellipse = createLayer({ id: "e", archetype: "ellipse", parentId: "pg", name: "e", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 100, "frame.height": 100 } }) as Layer;
    const inside = rect("r", fills({ mask: { type: "layer", id: "e" } }));
    const html = draw([page([ellipse, inside]), ellipse, inside], "r");
    assert.match(html, /<mask id="r__f0__mask"[^>]*><path d="M100 50/);
    const outside = rect("r", fills({ mask: { type: "layer", id: "e", invert: true } }));
    assert.match(draw([page([ellipse, outside]), ellipse, outside], "r"), /fill-rule="evenodd"/);
    const lost = rect("r", fills({ mask: { type: "layer", id: "nowhere" } }));
    assert.doesNotMatch(draw([page([lost]), lost], "r"), /<mask /);
  });

  it("the fade rule: shown at the start, gone at the end, in between linearly", () => {
    const lin = { type: "linear" as const, start: 0, end: 1, angle: 0 };
    assert.equal(fadeAt(lin, 200, 100, 100, 0), 1);
    assert.equal(fadeAt(lin, 200, 100, 100, 100), 0);
    assert.equal(fadeAt(lin, 200, 100, 100, 25), 0.75);
    assert.equal(fadeAt({ ...lin, angle: 90 }, 200, 100, 50, 50), 0.75, "90° fades to the right");
    assert.equal(fadeAt({ type: "radial", start: 0, end: 1, angle: 0 }, 200, 100, 100, 50), 1, "the centre");
    assert.ok(Math.abs(fadeAt({ type: "conic", start: 0, end: 1, angle: 0 }, 200, 100, 200, 50) - 0.75) < 1e-9, "a quarter turn from the top");
  });
});
