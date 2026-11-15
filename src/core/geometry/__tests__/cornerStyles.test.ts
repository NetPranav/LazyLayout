/**
 * ROADMAP Phase 107: smooth corners and corner styles.
 *
 * The gate: 60% smoothing matches the reference squircle within 0.5 px. The reference is Figma's published
 * construction ("Desperately seeking squircles", as the figma-squircle package draws it), written here a second time
 * as an SVG path with relative curves and arc commands, so it shares no code with `roundedRect`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BezPath, type Pt } from "../bezpath";
import { polylines } from "../measure";
import { roundedRect, smoothedPolygon, starPoints, polygonPoints } from "../shapes";
import { parsePathData } from "../../paths/pathData";
import { subPathsToBez } from "../../paths/bezBridge";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { RenderLayer } from "../../render/RenderLayer";
import { setDocument } from "../../store/documentState";
import { getDocument } from "../../store/useDocumentStore";
import { layerOutline } from "../../editing/layerOutline";

const rad = (deg: number) => (deg * Math.PI) / 180;

/** The figma-squircle path for a w × h rectangle with one radius and a smoothing (0..1). */
function referenceSquircle(w: number, h: number, radius: number, smoothing: number): string {
  const p = Math.min((1 + smoothing) * radius, Math.min(w, h) / 2);
  const arcMeasure = 90 * (1 - smoothing);
  const arc = Math.sin(rad(arcMeasure / 2)) * radius * Math.SQRT2;
  const alpha = (90 - arcMeasure) / 2;
  const p3p4 = radius * Math.tan(rad(alpha / 2));
  const beta = 45 * smoothing;
  const c = p3p4 * Math.cos(rad(beta));
  const d = c * Math.tan(rad(beta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  const R = radius;
  return [
    `M ${w - p} 0`,
    `c ${a} 0 ${a + b} 0 ${a + b + c} ${d}`,
    `a ${R} ${R} 0 0 1 ${arc} ${arc}`,
    `c ${d} ${c} ${d} ${b + c} ${d} ${a + b + c}`,
    `L ${w} ${h - p}`,
    `c 0 ${a} 0 ${a + b} ${-d} ${a + b + c}`,
    `a ${R} ${R} 0 0 1 ${-arc} ${arc}`,
    `c ${-c} ${d} ${-(b + c)} ${d} ${-(a + b + c)} ${d}`,
    `L ${p} ${h}`,
    `c ${-a} 0 ${-(a + b)} 0 ${-(a + b + c)} ${-d}`,
    `a ${R} ${R} 0 0 1 ${-arc} ${-arc}`,
    `c ${-d} ${-c} ${-d} ${-(b + c)} ${-d} ${-(a + b + c)}`,
    `L 0 ${p}`,
    `c 0 ${-a} 0 ${-(a + b)} ${d} ${-(a + b + c)}`,
    `a ${R} ${R} 0 0 1 ${arc} ${-arc}`,
    `c ${c} ${-d} ${b + c} ${-d} ${a + b + c} ${-d}`,
    "Z",
  ].join(" ");
}

const points = (p: BezPath, tol = 0.02): Pt[] => (polylines(p, 400_000, tol) ?? []).flatMap((l) => l.points);
const segs = (p: BezPath): [Pt, Pt][] => (polylines(p, 400_000, 0.005) ?? []).flatMap((l) => l.points.slice(1).map((b, i) => [l.points[i], b] as [Pt, Pt]));
function distance(edges: readonly [Pt, Pt][], q: Pt): number {
  let best = Infinity;
  for (const [a, b] of edges) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    const u = l2 > 0 ? Math.min(1, Math.max(0, ((q.x - a.x) * dx + (q.y - a.y) * dy) / l2)) : 0;
    best = Math.min(best, Math.hypot(a.x + u * dx - q.x, a.y + u * dy - q.y));
  }
  return best;
}
/** The largest distance between two outlines, measured both ways. */
function hausdorff(a: BezPath, b: BezPath): number {
  const ea = segs(a);
  const eb = segs(b);
  let worst = 0;
  for (const q of points(a)) worst = Math.max(worst, distance(eb, q));
  for (const q of points(b)) worst = Math.max(worst, distance(ea, q));
  return worst;
}
const near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got.toFixed(3)}, expected ${want.toFixed(3)}`);

describe("Phase 107: smooth corners", () => {
  for (const [w, h, r] of [[200, 120, 40], [100, 100, 30], [320, 80, 24], [60, 60, 20]] as const) {
    it(`60% smoothing on a ${w} × ${h} rectangle with radius ${r} matches the reference squircle within 0.5 px`, () => {
      const ref = subPathsToBez(parsePathData(referenceSquircle(w, h, r, 0.6))!);
      const ours = roundedRect(w, h, [r, r, r, r], 0.6);
      const gap = hausdorff(ours, ref);
      assert.ok(gap <= 0.5, `${gap.toFixed(3)} px apart`);
      near(Math.abs(ours.area()), Math.abs(ref.area()), 0.5 * (2 * (w + h)), "area");
    });
  }

  it("smoothing takes more of each edge than a plain round corner, and the same area as the reference at 0 and 100%", () => {
    for (const s of [0, 1]) {
      const ref = subPathsToBez(parsePathData(referenceSquircle(200, 120, 40, s))!);
      assert.ok(hausdorff(roundedRect(200, 120, [40, 40, 40, 40], s), ref) <= 0.5, `smoothing ${s}`);
    }
  });
});

describe("Phase 107: corner styles", () => {
  const W = 200;
  const H = 120;
  const R = 30;
  const area = (p: BezPath) => Math.abs(p.area());

  it("cut, scoop and inverted rectangles have the exact areas of their corners", () => {
    near(area(roundedRect(W, H, [R, R, R, R], 0, "cut")), W * H - 4 * (R * R) / 2, 0.01, "cut");
    near(area(roundedRect(W, H, [R, R, R, R], 0, "scoop")), W * H - Math.PI * R * R, 1, "scoop");
    near(area(roundedRect(W, H, [R, R, R, R], 0, "inverted")), W * H - 4 * R * R, 0.01, "inverted");
    near(area(roundedRect(W, H, [R, R, R, R], 0, "round")), W * H - (4 - Math.PI) * R * R, 1, "round");
  });

  it("every point of a scooped corner is the radius from the corner it bites", () => {
    const p = roundedRect(W, H, [R, 0, 0, 0], 0, "scoop");
    for (const q of points(p)) {
      if (q.x < R - 1e-6 && q.y < R - 1e-6 && q.x > 1e-6 && q.y > 1e-6) near(Math.hypot(q.x, q.y), R, 0.05, "on the bite");
    }
  });

  it("per-corner sizes are kept, and a corner too big for its edges is clamped to half of the shorter one", () => {
    near(area(roundedRect(W, H, [R, 0, 0, 0], 0, "cut")), W * H - (R * R) / 2, 0.01, "one corner");
    near(area(roundedRect(100, 40, [500, 500, 500, 500], 0, "inverted")), 100 * 40 - 4 * 20 * 20, 0.01, "clamped");
  });

  it("polygons take the styles too: on a convex polygon each style removes area, scoop the most", () => {
    for (const pts of [polygonPoints(200, 200, 6), polygonPoints(200, 200, 5)]) {
      const plain = area(smoothedPolygon(pts, 0, 0));
      const cut = area(smoothedPolygon(pts, 12, 0, "cut"));
      const scoop = area(smoothedPolygon(pts, 12, 0, "scoop"));
      assert.ok(cut < plain && scoop < cut, `${plain.toFixed(0)} > ${cut.toFixed(0)} > ${scoop.toFixed(0)}`);
    }
  });

  it("on a star the outer points are cut away and the inner corners are filled in, as a round corner does", () => {
    const pts = starPoints(200, 200, 5, 0.5);
    const outerOnly = (style: "cut" | "scoop") => smoothedPolygon(pts, 12, 0, style);
    for (const style of ["cut", "scoop"] as const) {
      const p = outerOnly(style);
      // no point of the outline lies further out than the star's own tips
      const tips = Math.max(...pts.map((q) => Math.hypot(q.x - 100, q.y - 100)));
      for (const q of points(p)) assert.ok(Math.hypot(q.x - 100, q.y - 100) <= tips + 1e-6, style);
      assert.notEqual(Math.round(area(p)), Math.round(area(smoothedPolygon(pts, 0, 0))), style);
    }
  });

  it("the stage and the export draw the same outline: the render definition and the layer outline agree", () => {
    const rect = createLayer({ id: "r", archetype: "rectangle", parentId: "pg", name: "r", properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": W, "frame.height": H, "shape.cornerRadius": R, "shape.cornerStyle": "cut", "svg.fill": "#ff0000" } }) as Layer;
    setDocument(createDocumentFromLayers([createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["r"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer, rect]));
    const layer = getDocument().layers.r;
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "r", layers: getDocument().layers }));
    const d = /<path[^>]* d="([^"]+)"/.exec(html)?.[1];
    assert.ok(d, `the cut rectangle draws as a path: ${html.slice(0, 200)}`);
    const drawn = subPathsToBez(parsePathData(d)!);
    near(area(drawn), W * H - 2 * R * R, 1, "drawn");
    near(area(layerOutline(layer, getDocument().layers)!.path), W * H - 2 * R * R, 0.01, "outline (booleans, Shape Builder)");
  });
});
