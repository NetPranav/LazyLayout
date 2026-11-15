/**
 * ROADMAP Phase 121: layer effects II. A glow is a shadow with no offset (drawn as one, kept as a glow); a progressive
 * blur ramps towards the edge it names; grain is a mono noise; frosted glass is a blur, a tint, an edge light and a
 * little grain; and a layer that blurs its backdrop carries a fallback tint for browsers without `backdrop-filter`.
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
import { boxShadowCss, parseShadows, serializeShadows } from "../paints";
import { blurBands, blurOf, parseEffects, serializeEffects } from "../effects";
import { BACKDROP_FALLBACK_CSS, backdropFallback, directionOf, directionPoints, frostedGlassProps, glowShadow, grainIn, withGrain, withProgressiveBlur } from "../effectsII";
import { applyFrostedGlass } from "../../editing/effectsIIOps";

const header = (props: Record<string, unknown> = {}): Layer =>
  createLayer({ id: "h", archetype: "container", parentId: "pg", name: "Header", properties: { positioning: "absolute", "frame.width": 400, "frame.height": 80, ...props } }) as Layer;

beforeEach(() =>
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["h"], properties: { "frame.width": 800, "frame.height": 600 } }) as Layer,
      header({ "paint.effects": JSON.stringify([{ type: "texture", size: 1, radius: 3, clipToShape: true }]) }),
    ]),
  ),
);

describe("Phase 121: glow, progressive blur, grain", () => {
  it("a glow is a shadow with no offset, kept as a glow through save and load", () => {
    const g = glowShadow(false, "rgba(255, 210, 74, 0.8)", 16, 2);
    const back = parseShadows(serializeShadows([g, glowShadow(true, "#ffffff", 4, 0)]));
    assert.deepEqual(back.map((s) => [s.kind, s.glow]), [["drop", true], ["inner", true]]);
    assert.equal(boxShadowCss(back), "0px 0px 16px 2px rgba(255, 210, 74, 0.8), inset 0px 0px 4px 0px rgba(255, 255, 255, 1)");
  });

  it("a progressive blur stronger at the top: its bands end on the top edge, and the direction reads back", () => {
    const fx = withProgressiveBlur([], "backgroundBlur", { radius: 24, startRadius: 0, direction: "up" });
    const b = blurOf(parseEffects(serializeEffects(fx)), "backgroundBlur")!;
    assert.equal(b.blurType, "progressive");
    assert.deepEqual([b.start, b.end], [[0.5, 1], [0.5, 0]]);
    assert.equal(directionOf(b.start, b.end), "up");
    const bands = blurBands(b);
    assert.equal(bands.length, 5);
    assert.equal(bands[bands.length - 1].radius, 24);
    assert.match(bands[0].mask, /^linear-gradient\(0deg/, "the ramp runs up the layer");
    for (const d of ["up", "down", "left", "right"] as const) assert.equal(directionOf(directionPoints(d).start, directionPoints(d).end), d);
  });

  it("grain is a mono noise whose grains' opacity is its strength; other effects stay", () => {
    const base = parseEffects(JSON.stringify([{ type: "texture", size: 1, radius: 3 }]));
    const fx = withGrain(base, { size: 0.75, amount: 0.2 });
    assert.deepEqual(grainIn(fx), { size: 0.75, amount: 0.2 });
    assert.equal(fx.filter((e) => e.type === "texture").length, 1);
    assert.equal(grainIn(withGrain(fx, null)), null);
  });
});

describe("Phase 121: frosted glass and the fallback", () => {
  it("frosted glass: a background blur, a light tint, an edge light and a little grain; a layer's own colour stays", () => {
    const p = frostedGlassProps({});
    assert.equal(p["paint.backgroundBlur"], 20);
    assert.equal(p["appearance.background.color"], "rgba(255, 255, 255, 0.18)");
    assert.deepEqual(parseShadows(p["paint.shadows"]).map((s) => [s.kind, s.glow, s.blur]), [["inner", true, 2]]);
    assert.ok(grainIn(parseEffects(p["paint.effects"])));
    assert.equal(frostedGlassProps({ "appearance.background.color": "#112233" })["appearance.background.color"], undefined);
    // the command: one layer changed, its texture kept
    assert.equal(applyFrostedGlass(["h"]), 1);
    const fx = parseEffects(getDocument().layers.h.properties["paint.effects"]);
    assert.deepEqual(fx.map((e) => e.type).sort(), ["noise", "texture"]);
  });

  it("a layer that blurs its backdrop carries a fallback tint, at least 85% opaque, and the rule that swaps it in", () => {
    const get = (p: Record<string, unknown>) => (path: string) => p[path];
    assert.equal(backdropFallback(get({})), null);
    assert.equal(backdropFallback(get({ "paint.backgroundBlur": 12 })), "rgba(255, 255, 255, 0.85)");
    assert.equal(backdropFallback(get({ "paint.backgroundBlur": 12, "appearance.background.color": "rgba(10, 20, 30, 0.3)" })), "rgba(10, 20, 30, 0.85)");
    assert.ok(backdropFallback(get({ "paint.effects": serializeEffects(withProgressiveBlur([], "backgroundBlur", { radius: 10, startRadius: 0, direction: "down" })) })));
    assert.match(BACKDROP_FALLBACK_CSS, /^@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)/);

    const l = header({ "paint.backgroundBlur": 16, "appearance.background.color": "rgba(255, 255, 255, 0.2)" });
    const html = renderToStaticMarkup(createElement(RenderLayer, { layerId: "h", layers: { h: l } }));
    assert.match(html, /data-backdrop-fallback=""/);
    assert.match(html, /--ll-backdrop-fallback:rgba\(255, 255, 255, 0.85\)/);
    assert.match(html, /<style data-backdrop-fallback-rule="">@supports not/);
    assert.doesNotMatch(renderToStaticMarkup(createElement(RenderLayer, { layerId: "h", layers: { h: header() } })), /backdrop-fallback/);
  });
});
