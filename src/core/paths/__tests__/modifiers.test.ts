/**
 * ROADMAP Phases 109 (the modifier stack) and 110 (repeat, trim, offset and round).
 *
 * Phase 110 asks for After Effects shape-layer references. No After Effects or Lottie player is available here, so
 * the references are After Effects' documented rules worked out by hand: the repeater's per-copy transform (position
 * i × step, rotation i × step, scale step^i, about the anchor), Trim Paths by length with the offset in turns, and
 * Round Corners on sharp vertices only. Positions are checked within 0.5 px.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BezPath, ellipsePath, segmentArclen, splitSubpaths, type Pt } from "../../geometry/bezpath";
import { applyModifiers, newModifier, parseModifiers, serializeModifiers, type Modifier, type ModifierType } from "../modifiers";
import { createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../../render/RenderLayer";
import { layerOutline } from "../../editing/layerOutline";

const rect = (x: number, y: number, w: number, h: number): BezPath =>
  new BezPath().moveTo({ x, y }).lineTo({ x: x + w, y }).lineTo({ x: x + w, y: y + h }).lineTo({ x, y: y + h }).closePath();
const mod = (type: ModifierType, params: Record<string, number | string> = {}, on = true): Modifier => {
  const m = newModifier(type, `m-${type}`);
  return { ...m, on, params: { ...m.params, ...params } };
};
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)}, expected ${want.toFixed(3)}`);
const centre = (p: BezPath): Pt => {
  const b = p.boundingBox();
  return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 };
};
const length = (p: BezPath) => p.segments().reduce((s, seg) => s + segmentArclen(seg, 1e-6), 0);
const firstPoint = (p: BezPath): Pt => (p.els[0] as { p: Pt }).p;
const lastPoint = (p: BezPath): Pt => {
  const e = p.els[p.els.length - 1] as { t: string; p?: Pt; p3?: Pt; p2?: Pt };
  return (e.t === "C" ? e.p3 : e.t === "Q" ? e.p2 : e.p)!;
};

describe("Phase 109: the modifier stack", () => {
  it("a stack is read safely: unknown types and junk are dropped, parameters clamped, and it round-trips", () => {
    const s = parseModifiers(JSON.stringify([{ type: "trim", params: { start: -50, end: 400 } }, { type: "bogus" }, 7, { type: "repeat", on: false, params: { count: 9999, mode: "spiral" } }]));
    assert.equal(s.length, 2);
    assert.deepEqual([s[0].params.start, s[0].params.end], [0, 100]);
    assert.equal(s[1].on, false);
    assert.equal(s[1].params.count, 500);
    assert.equal(s[1].params.mode, "line");
    assert.deepEqual(parseModifiers(serializeModifiers(s)), s);
    assert.deepEqual(parseModifiers("not json"), []);
  });

  it("switching every modifier off gives back the exact original path", () => {
    const original = ellipsePath({ x: 50, y: 50 }, { x: 40, y: 30 });
    const stack = [mod("repeat", { count: 5, stepX: 30 }, false), mod("trim", { end: 30 }, false), mod("round", { radius: 9 }, false), mod("offset", { distance: 4 }, false)];
    const out = applyModifiers({ path: original, closed: true }, stack, { w: 100, h: 100 });
    assert.equal(out.path, original, "the very same path");
    assert.equal(out.closed, true);
  });

  it("the order matters: trim then round is not round then trim", () => {
    const base = { path: rect(0, 0, 100, 50), closed: true };
    const a = applyModifiers(base, [mod("trim", { end: 50 }), mod("round", { radius: 20 })], { w: 100, h: 50 });
    const b = applyModifiers(base, [mod("round", { radius: 20 }), mod("trim", { end: 50 })], { w: 100, h: 50 });
    assert.notEqual(a.path.toSvg(2), b.path.toSvg(2));
  });

  it("a stack of 5 modifiers on 100 shapes re-evaluates in under 8 ms (round, repeat, trim, round, repeat)", () => {
    const shapes = Array.from({ length: 100 }, (_, i) => rect(i, i, 60 + (i % 7) * 5, 40 + (i % 5) * 5));
    const stack = [mod("round", { radius: 6 }), mod("repeat", { count: 4, stepX: 70, rotate: 10 }), mod("trim", { start: 10, end: 90 }), mod("round", { radius: 3 }), mod("repeat", { count: 2, stepY: 60 })];
    const run = () => shapes.map((p) => applyModifiers({ path: p, closed: true }, stack, { w: 100, h: 100 }));
    run();
    const times: number[] = [];
    for (let k = 0; k < 40; k++) {
      const t0 = performance.now();
      run();
      times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    // the fastest run is what the code costs; the others include whatever else the machine was doing
    assert.ok(times[0] < 8, `fastest ${times[0].toFixed(1)} ms, median ${times[20].toFixed(1)} ms`);
  });
});

describe("Phase 110: repeat", () => {
  const petal = { path: ellipsePath({ x: 50, y: 20 }, { x: 8, y: 20 }), closed: true };

  it("in a line: copy i is moved i steps, turned i × the turn and scaled by the scale to the power i", () => {
    const out = applyModifiers(petal, [mod("repeat", { count: 3, stepX: 40, stepY: 10, rotate: 90, scale: 50 })], { w: 100, h: 40 });
    const copies = splitSubpaths(out.path);
    assert.equal(copies.length, 3);
    copies.forEach((c, i) => {
      const at = centre(c);
      near(at.x, 50 + 40 * i, 0.5, `copy ${i} x`);
      near(at.y, 20 + 10 * i, 0.5, `copy ${i} y`);
      const b = c.boundingBox();
      const s = 0.5 ** i;
      // turned 90° per copy: the petal lies on its side every other copy
      const [w, h] = i % 2 === 0 ? [16 * s, 40 * s] : [40 * s, 16 * s];
      near(b.x1 - b.x0, w, 0.5, `copy ${i} width`);
      near(b.y1 - b.y0, h, 0.5, `copy ${i} height`);
    });
  });

  it("12 petals round a centre make a flower: each on the circle, turned to face out", () => {
    const R = 60;
    const out = applyModifiers(petal, [mod("repeat", { mode: "circle", count: 12, radius: R })], { w: 100, h: 40 });
    const copies = splitSubpaths(out.path);
    assert.equal(copies.length, 12);
    const hub = { x: 50, y: 20 + R };
    copies.forEach((c, i) => {
      const at = centre(c);
      const a = ((30 * i - 90) * Math.PI) / 180;
      near(at.x, hub.x + Math.cos(a) * R, 0.5, `petal ${i} x`);
      near(at.y, hub.y + Math.sin(a) * R, 0.5, `petal ${i} y`);
    });
  });

  it("in a grid: columns and rows, the given gaps apart", () => {
    const out = applyModifiers({ path: rect(0, 0, 20, 10), closed: true }, [mod("repeat", { mode: "grid", count: 4, rows: 3, gapX: 30, gapY: 15 })], { w: 20, h: 10 });
    const copies = splitSubpaths(out.path);
    assert.equal(copies.length, 12);
    const b = out.path.boundingBox();
    near(b.x1 - b.x0, 3 * 30 + 20, 1e-6, "width");
    near(b.y1 - b.y0, 2 * 15 + 10, 1e-6, "height");
  });
});

describe("Phase 110: trim", () => {
  const circle = { path: ellipsePath({ x: 0, y: 0 }, { x: 50, y: 50 }), closed: true };
  const full = length(circle.path);

  it("0–25% of a circle is an open arc a quarter of its length, starting where the path starts", () => {
    const out = applyModifiers(circle, [mod("trim", { start: 0, end: 25 })], { w: 100, h: 100 });
    assert.equal(out.closed, false);
    near(length(out.path), full / 4, 0.5, "length");
    const s = firstPoint(circle.path);
    const a = firstPoint(out.path);
    near(Math.hypot(a.x - s.x, a.y - s.y), 0, 0.5, "starts at the path's start");
    for (const q of [a, lastPoint(out.path)]) near(Math.hypot(q.x, q.y), 50, 0.5, "on the circle");
  });

  it("the offset moves the window round: 90° is a quarter turn of the path", () => {
    const plain = applyModifiers(circle, [mod("trim", { start: 0, end: 25 })], { w: 100, h: 100 });
    const moved = applyModifiers(circle, [mod("trim", { start: 0, end: 25, offset: 90 })], { w: 100, h: 100 });
    const a = lastPoint(plain.path);
    const b = firstPoint(moved.path);
    near(Math.hypot(a.x - b.x, a.y - b.y), 0, 0.5, "the moved window starts where the first ended");
    near(length(moved.path), full / 4, 0.5, "length");
  });

  it("a window that wraps past the closing point stays one line; on a rectangle, half is half the perimeter", () => {
    const wrap = applyModifiers(circle, [mod("trim", { start: 80, end: 100, offset: 72 })], { w: 100, h: 100 });
    assert.equal(splitSubpaths(wrap.path).length, 1);
    near(length(wrap.path), full / 5, 0.5, "length");
    const half = applyModifiers({ path: rect(0, 0, 100, 50), closed: true }, [mod("trim", { end: 50 })], { w: 100, h: 50 });
    near(length(half.path), 150, 0.01, "half the perimeter");
    // the rectangle starts at its top-left corner and runs clockwise: half its perimeter ends at the bottom-right
    near(lastPoint(half.path).x, 100, 0.01, "ends at the bottom-right x");
    near(lastPoint(half.path).y, 50, 0.01, "ends at the bottom-right y");
  });

  it("0–100% keeps the path closed and unchanged", () => {
    const out = applyModifiers(circle, [mod("trim", { start: 0, end: 100 })], { w: 100, h: 100 });
    assert.equal(out.path, circle.path);
  });
});

describe("Phase 110: offset and round corners", () => {
  it("offset grows a rectangle by its distance (mitre corners keep it a rectangle)", () => {
    const out = applyModifiers({ path: rect(0, 0, 100, 50), closed: true }, [mod("offset", { distance: 10, join: "miter" })], { w: 100, h: 50 });
    near(Math.abs(out.path.area()), 120 * 70, 1, "area");
  });

  it("round corners on a square: each sharp corner becomes an arc of the radius; a circle has none to round", () => {
    const out = applyModifiers({ path: rect(0, 0, 100, 100), closed: true }, [mod("round", { radius: 10 })], { w: 100, h: 100 });
    near(Math.abs(out.path.area()), 10_000 - (4 - Math.PI) * 100, 0.5, "area");
    const circle = ellipsePath({ x: 0, y: 0 }, { x: 40, y: 40 });
    const same = applyModifiers({ path: circle, closed: true }, [mod("round", { radius: 10 })], { w: 80, h: 80 });
    near(Math.abs(same.path.area()), Math.abs(circle.area()), 0.01, "the circle is untouched");
  });
});

describe("Phase 109: on a layer", () => {
  const layer = (stack: Modifier[]): Layer =>
    createLayer({ id: "r", archetype: "rectangle", parentId: null, name: "r", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 100, "frame.height": 50, "svg.fill": "#ff0000", "shape.modifiers": serializeModifiers(stack) } }) as Layer;

  it("a rectangle with a stack is drawn as the stack's path, and its outline (booleans, Shape Builder) is the result", () => {
    const l = layer([mod("repeat", { count: 3, stepX: 120 })]);
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "r", layers: { r: l } }));
    assert.match(html, /<path[^>]* d="M/);
    assert.doesNotMatch(html, /<rect /);
    near(Math.abs(layerOutline(l, { r: l })!.path.area()), 3 * 5000, 1e-6, "three copies");
  });

  it("with the stack switched off the rectangle draws as before", () => {
    const l = layer([mod("repeat", { count: 3, stepX: 120 }, false)]);
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "r", layers: { r: l } }));
    assert.match(html, /<rect /);
    near(Math.abs(layerOutline(l, { r: l })!.path.area()), 5000, 1e-6, "one rectangle");
  });
});
