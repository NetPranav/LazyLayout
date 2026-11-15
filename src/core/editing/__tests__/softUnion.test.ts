/**
 * ROADMAP Phase 108: soft union. Two circles of radius R, softness k, at five distances. Where the gap is under 2k
 * the circles are joined by a neck bounded by two fillet circles of radius k, each touching both circles; its area
 * is exact: the kite between the four centres, less the two circles' sectors and the two fillets' sectors. Where
 * the gap is wider the circles stay apart, untouched.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../../render/RenderLayer";
import { parsePathData } from "../../paths/pathData";
import { subPathsToBez } from "../../paths/bezBridge";
import { booleanGroupResult } from "../layerOutline";

const R = 40;
const K = 10;

/** The melted shape's exact area for two circles whose centres are `D` apart (gap under 2k, fillets apart). */
function softArea(D: number): number {
  const s = R + K;
  const theta = Math.acos(D / 2 / s);
  const h = Math.sqrt(s * s - (D / 2) ** 2);
  const phi = Math.PI - 2 * theta;
  const neck = D * h - 2 * theta * R * R - phi * K * K;
  return 2 * Math.PI * R * R + neck;
}

function group(D: number, softness: number): Record<string, Layer> {
  const c = (id: string, cx: number): Layer =>
    createLayer({ id, archetype: "ellipse", parentId: "g", name: id, properties: { positioning: "absolute", "frame.x": cx - R, "frame.y": 60 - R, "frame.width": 2 * R, "frame.height": 2 * R, "svg.fill": "#000000" } }) as Layer;
  const g = createLayer({
    id: "g",
    archetype: "container",
    parentId: null,
    name: "Soft",
    children: ["a", "b"],
    properties: { "boolean.operation": "union", "boolean.softness": softness, "frame.x": 0, "frame.y": 0, "frame.width": 2 * R + D + 20, "frame.height": 120, "svg.fill": "#000000" },
  }) as Layer;
  return { g, a: c("a", 50), b: c("b", 50 + D) };
}

const area = (layers: Record<string, Layer>) => Math.abs(booleanGroupResult(layers.g, layers)!.area());
const circle = Math.PI * R * R;

describe("Phase 108: soft union", () => {
  for (const gap of [0, 4, 8, 14]) {
    it(`two circles ${gap} px apart melt together with the exact neck (within 1%)`, () => {
      const D = 2 * R + gap;
      const got = area(group(D, K));
      const want = softArea(D);
      assert.ok(Math.abs(got - want) / want < 0.01, `${got.toFixed(1)} against ${want.toFixed(1)}`);
      assert.ok(got > 2 * circle * (gap === 0 ? 0.99 : 1), "the neck adds area");
      // one piece: the shape is a single outline
      assert.equal(booleanGroupResult(group(D, K).g, group(D, K))!.els.filter((e) => e.t === "M").length, 1);
    });
  }

  it("circles further apart than twice the softness stay apart and untouched", () => {
    const layers = group(2 * R + 30, K);
    const got = area(layers);
    assert.ok(Math.abs(got - 2 * circle) / (2 * circle) < 0.002, `${got.toFixed(1)}`);
    assert.equal(booleanGroupResult(layers.g, layers)!.els.filter((e) => e.t === "M").length, 2);
  });

  it("softness 0 is the hard union, and softness only applies to union groups", () => {
    const hard = group(2 * R + 4, 0);
    assert.ok(Math.abs(area(hard) - 2 * circle) / (2 * circle) < 0.002);
    const sub = group(2 * R + 4, K);
    sub.g = { ...sub.g, properties: { ...sub.g.properties, "boolean.operation": "subtract" } } as Layer;
    assert.ok(Math.abs(area(sub) - circle) / circle < 0.002, "subtract ignores softness");
  });

  it("the outer edges stay sharp and in place: every outline point far from the neck is on a circle", () => {
    const layers = group(2 * R + 8, K);
    const res = booleanGroupResult(layers.g, layers)!;
    const cx = [50, 50 + 2 * R + 8];
    for (const e of res.els) {
      const p = e.t === "C" ? e.p3 : e.t === "M" || e.t === "L" ? e.p : null;
      if (!p) continue;
      const mid = (cx[0] + cx[1]) / 2;
      if (Math.abs(p.x - mid) < 25) continue; // the neck
      const d = Math.min(...cx.map((x) => Math.hypot(p.x - x, p.y - 60)));
      assert.ok(Math.abs(d - R) < 0.25, `a point ${d.toFixed(3)} from a centre`);
    }
  });

  it("the stage and the export draw the melted shape: the render definition's path has the same area", () => {
    const layers = group(2 * R + 8, K);
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "g", layers }));
    const d = /data-boolean="union"[\s\S]*?<path[^>]* d="([^"]+)"/.exec(html)?.[1];
    assert.ok(d, html.slice(0, 300));
    const drawn = Math.abs(subPathsToBez(parsePathData(d)!).area());
    assert.ok(Math.abs(drawn - softArea(2 * R + 8)) / drawn < 0.01, `${drawn.toFixed(1)}`);
  });
});
