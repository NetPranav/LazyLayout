/**
 * ROADMAP Phase 119: variable-width strokes. Profiles round-trip exactly (a layer's property, a saved profile, the
 * file saved and loaded); a calligraphic profile is thick across the nib and thin along it; a profile is drawn as
 * an outlined path, the same outline the outliner makes.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import { parseMotionDocument, type Layer } from "../../document/schema";
import { getDocument } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { BezPath } from "../../geometry/bezpath";
import { RenderLayer } from "../../render/RenderLayer";
import { parseWidthProfile, presetProfile, serializeWidthProfile, sidesAt, variableOutline, WIDTH_PRESETS } from "../strokes";
import { calligraphicProfile, matchSaved, savedProfilesOf } from "../widthProfiles";
import { applyCalligraphic, applyWidthProfile, profileOf, removeWidthProfile, renameWidthProfile, saveWidthProfile } from "../../editing/widthProfileOps";

const ODD = [{ t: 0, scale: 0 }, { t: 0.137, scale: 1.25, bias: 0.3 }, { t: 0.5, scale: 0.4 }, { t: 0.91, scale: 2 }, { t: 1, scale: 0 }];

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["ln", "curve"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      createLayer({ id: "ln", archetype: "line", parentId: "pg", name: "Line", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 10, "frame.width": 300, "frame.height": 20, "svg.stroke": "#111111", "svg.strokeWidth": 12 } }) as Layer,
      createLayer({ id: "curve", archetype: "svgPath", parentId: "pg", name: "Curve", properties: { positioning: "absolute", "frame.x": 10, "frame.y": 100, "frame.width": 200, "frame.height": 200, "svg.path": "M10 100 A90 90 0 1 1 190 100 A90 90 0 1 1 10 100", "svg.fill": "none", "svg.stroke": "#111111", "svg.strokeWidth": 10 } }) as Layer,
    ]),
  ),
);

describe("Phase 119: width profiles round-trip exactly", () => {
  it("stored text reads back to the same text, and every preset (with the new swell) is a fixed point", () => {
    const once = serializeWidthProfile(parseWidthProfile(JSON.stringify(ODD)));
    assert.equal(serializeWidthProfile(parseWidthProfile(once)), once);
    assert.ok(WIDTH_PRESETS.includes("swell"));
    for (const p of WIDTH_PRESETS) {
      const pts = presetProfile(p);
      assert.deepEqual(parseWidthProfile(serializeWidthProfile(pts)), pts, p);
    }
  });

  it("a saved profile, applied to another stroke, gives it the same points; and it survives the file being saved and loaded", () => {
    applyWidthProfileFrom("ln", ODD);
    const id = saveWidthProfile("Brush tip", { layerId: "ln" })!;
    assert.ok(id);
    assert.equal(applyWidthProfile(["curve"], id), 1);
    assert.deepEqual(profileOf("curve"), profileOf("ln"));
    assert.equal(getDocument().layers.curve.properties["stroke.widthProfile"], getDocument().layers.ln.properties["stroke.widthProfile"]);
    assert.equal(matchSaved(savedProfilesOf(getDocument()), profileOf("curve"))?.name, "Brush tip");

    const reloaded = parseMotionDocument(JSON.parse(JSON.stringify(getDocument())));
    assert.deepEqual(savedProfilesOf(reloaded), savedProfilesOf(getDocument()));
    assert.equal(reloaded.layers.curve.properties["stroke.widthProfile"], getDocument().layers.curve.properties["stroke.widthProfile"]);

    assert.ok(renameWidthProfile(id, "Ink"));
    assert.equal(savedProfilesOf(getDocument())[0].name, "Ink");
    assert.ok(removeWidthProfile(id));
    assert.equal((getDocument() as { widthProfiles?: unknown }).widthProfiles, undefined, "the last one gone leaves no list");
    assert.deepEqual(profileOf("curve"), profileOf("ln"), "strokes keep the points");
  });

  it("an empty name or an empty profile saves nothing", () => {
    assert.equal(saveWidthProfile("  ", { points: ODD }), null);
    assert.equal(saveWidthProfile("x", { layerId: "ln" }), null, "a uniform stroke has no profile to save");
  });
});

describe("Phase 119: calligraphic strokes", () => {
  it("a nib at 0° makes a horizontal line thin, and a vertical one thick", () => {
    const flat = calligraphicProfile(new BezPath().moveTo({ x: 0, y: 0 }).lineTo({ x: 100, y: 0 }), 0, 0.1)!;
    const tall = calligraphicProfile(new BezPath().moveTo({ x: 0, y: 0 }).lineTo({ x: 0, y: 100 }), 0, 0.1)!;
    assert.ok(flat.every((p) => Math.abs(p.scale - 0.1) < 1e-3));
    assert.ok(tall.every((p) => Math.abs(p.scale - 1) < 1e-3));
  });

  it("round a circle with a 45° nib: thickest where it runs across the nib, thinnest where it runs along it", () => {
    assert.equal(applyCalligraphic(["curve"], 45, 0.2), 1);
    const pts = profileOf("curve")!;
    assert.ok(pts.length >= 32);
    const scales = pts.map((p) => p.scale);
    assert.ok(Math.max(...scales) > 0.97 && Math.min(...scales) < 0.25);
    // round-trips like any other profile
    assert.deepEqual(parseWidthProfile(serializeWidthProfile(pts)), pts);
  });
});

describe("Phase 119: drawn as an outlined path", () => {
  it("a tapered line is drawn as a filled outline, as the outliner makes it, thin at the ends", () => {
    applyWidthProfileFrom("ln", presetProfile("taper")!);
    const l = getDocument().layers.ln;
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "ln", layers: { ln: l } }));
    const expected = variableOutline(new BezPath().moveTo({ x: 0, y: 10 }).lineTo({ x: 300, y: 10 }), 12, { join: "miter", miterLimit: 4, capStart: "none", capEnd: "none", dashes: [] }, presetProfile("taper")!)!;
    const d = expected.toSvg();
    assert.ok(d.length > 100);
    assert.ok(html.includes(`d="${d}"`), "the same outline as the outliner's");
    assert.deepEqual(sidesAt(presetProfile("taper")!, 0), [0, 0]);
  });
});

function applyWidthProfileFrom(id: string, pts: readonly { t: number; scale: number; bias?: number }[]) {
  const pid = saveWidthProfile("tmp", { points: pts })!;
  applyWidthProfile([id], pid);
  removeWidthProfile(pid);
}
