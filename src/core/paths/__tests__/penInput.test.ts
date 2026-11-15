/**
 * ROADMAP Phase 120: pen pressure, tilt and speed into width profiles. The same recorded input always gives the same
 * profile; harder is wider, a flatter pen is wider, faster is thinner; a mouse (no pressure) uses its speed; a brush
 * stroke is a path layer with its profile and brush, never closed or filled; a pencil stroke by mouse is as before.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { hasPressure, penWidthProfile, resolveSource, type PenSample } from "../penInput";
import { parseWidthProfile, scaleAt } from "../strokes";
import { createBrushStroke, DEFAULT_BRUSH_TOOL, pencilStrokeProps } from "../createPath";

/** A stroke left to right; pressure, tilt and timing as given per sample. */
const line = (n: number, f: (i: number) => Partial<PenSample>): PenSample[] => Array.from({ length: n }, (_, i) => ({ x: i * 4, y: 50 + Math.sin(i / 6) * 10, t: i * 8, p: 0.5, ...f(i) }));

describe("Phase 120: pen input into width", () => {
  it("harder is wider, and the same input gives the same profile every time", () => {
    const s = line(60, (i) => ({ p: 0.1 + (0.9 * i) / 59 }));
    const a = penWidthProfile(s, { smoothing: 0 })!;
    assert.deepEqual(penWidthProfile(s, { smoothing: 0 }), a);
    assert.ok(scaleAt(a, 0) < 0.3 && Math.abs(scaleAt(a, 1) - 1) < 1e-6, "light at the start, the full width at the end");
    assert.ok(a.every((p, i) => i === 0 || p.scale >= a[i - 1].scale - 1e-9), "and widening all the way");
    assert.equal(resolveSource(s, "auto"), "pressure");
  });

  it("a mouse has no pressure: auto uses its speed, and a fast stretch is thinner than a slow one", () => {
    // slow for the first half (2 px per 8 ms), fast for the second (12 px per 8 ms)
    let x = 0;
    const s = Array.from({ length: 80 }, (_, i) => ({ x: (x += i < 40 ? 2 : 12), y: 0, t: i * 8, p: 0.5 }));
    assert.equal(hasPressure(s), false);
    assert.equal(resolveSource(s, "auto"), "speed");
    const prof = penWidthProfile(s, { smoothing: 0.2 })!;
    assert.ok(scaleAt(prof, 0.05) > scaleAt(prof, 0.9) * 1.5, `slow ${scaleAt(prof, 0.05)} vs fast ${scaleAt(prof, 0.9)}`);
  });

  it("tilt: a pen laid flatter draws wider", () => {
    const s = line(40, (i) => ({ p: 0.6, tiltX: (i / 39) * 80, tiltY: 0 }));
    const prof = penWidthProfile(s, { source: "tilt", smoothing: 0 })!;
    assert.ok(scaleAt(prof, 0) < scaleAt(prof, 1) * 0.3);
  });

  it("smoothing steadies a shaky hand's pressure", () => {
    const s = line(100, (i) => ({ p: i % 2 ? 0.3 : 0.9 }));
    const spread = (pts: { scale: number }[]) => Math.max(...pts.map((p) => p.scale)) - Math.min(...pts.map((p) => p.scale));
    assert.ok(spread(penWidthProfile(s, { smoothing: 1 })!) < spread(penWidthProfile(s, { smoothing: 0, points: 64 })!) / 3);
  });

  it("no profile when nothing varies the width, or the stroke has no length", () => {
    assert.equal(penWidthProfile(line(20, () => ({})), { source: "none" }), null);
    assert.equal(penWidthProfile([{ x: 1, y: 1, t: 0, p: 0.5 }, { x: 1, y: 1, t: 9, p: 0.7 }]), null);
  });
});

describe("Phase 120: brush and pencil strokes", () => {
  beforeEach(() => setDocument(createDocumentFromLayers([createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: [], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer])));

  it("a brush stroke: an open path layer, no fill, its size, its pressure profile and its brush", () => {
    const s = line(60, (i) => ({ p: 0.2 + 0.8 * Math.sin((Math.PI * i) / 59) }));
    const id = createBrushStroke(s, { id: "pg", origin: { x: 0, y: 0 } }, { ...DEFAULT_BRUSH_TOOL, size: 14, brush: "ink" })!;
    const p = getDocument().layers[id].properties;
    assert.equal(getDocument().layers[id].archetype, "svgPath");
    assert.equal(p["svg.fill"], "none");
    assert.equal(p["svg.strokeWidth"], 14);
    assert.doesNotMatch(String(p["svg.path"]), /Z/i);
    const prof = parseWidthProfile(p["stroke.widthProfile"])!;
    assert.ok(scaleAt(prof, 0.5) > scaleAt(prof, 0.02) * 2, "it swells where the pen pressed hardest");
    assert.equal(JSON.parse(String(p["stroke.brush"])).preset, "ink");
  });

  it("a pencil stroke keeps a pen's pressure, and a mouse's pencil stroke is as before", () => {
    assert.deepEqual(pencilStrokeProps(line(30, () => ({}))), {});
    assert.ok(pencilStrokeProps(line(30, (i) => ({ p: 0.2 + i / 40 })))["stroke.widthProfile"]);
  });
});
