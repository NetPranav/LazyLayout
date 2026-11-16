import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import { getPropertyDefinition, isPropertyLegalFor } from "../../document/properties";
import { evaluate } from "../../kernel/evaluate";
import { interpolateValue } from "../../kernel/interpolators";
import { animatedPaths } from "../../engine/stage/styleWrites";
import { canRunOnWaapi } from "../../engine/stage/waapiEligibility";
import { KernelAdapter } from "../../engine/stage/KernelAdapter";
import { SvgPathWriter, writesSvgPath } from "../../engine/stage/svgPaths";
import { invokeCommand, tryRunCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { RenderLayer } from "../../render/RenderLayer";
import { pathDataToBez } from "../bezBridge";
import { MORPH_DEFAULTS, matchPaths, morphOptions, morphPath, subpathCount, subpathData } from "../morphMatch";
import { drawDashes, drawSettings, hasDraw, staggered } from "../strokeDraw";
import { registerPathMotionCommands } from "../pathMotionCommands";

/** ROADMAP Phase 85: path morph with point matching, and stroke drawing. */
/** A command's own answer (`{ ok, code, … }`). */
const runCommand = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result;
const MENU = "M4 6 L20 6 M4 12 L20 12 M4 18 L20 18";
const CLOSE = "M6 6 L18 18 M12 12 L12 12 M6 18 L18 6";
const SQUARE = "M0 0 L10 0 L10 10 L0 10 Z";
/** The same square, started at the opposite corner and drawn the other way round. */
const SQUARE_TURNED = "M10 10 L10 0 L0 0 L0 10 Z";
const reader = (o: Record<string, unknown>) => (p: string) => o[p];

/** Points along a path, by sampling each segment: enough to say two paths draw the same thing. */
function samples(d: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const s of pathDataToBez(d)!.segments()) {
    for (const u of [0, 0.5, 1]) {
      const p = s.kind === "line" ? { x: s.p0.x + (s.p1.x - s.p0.x) * u, y: s.p0.y + (s.p1.y - s.p0.y) * u } : s.kind === "cubic" ? cubicAt(s, u) : { x: 0, y: 0 };
      out.push([Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100]);
    }
  }
  return out;
}
function cubicAt(c: { p0: { x: number; y: number }; p1: { x: number; y: number }; p2: { x: number; y: number }; p3: { x: number; y: number } }, u: number) {
  const m = 1 - u;
  return { x: m * m * m * c.p0.x + 3 * m * m * u * c.p1.x + 3 * m * u * u * c.p2.x + u * u * u * c.p3.x, y: m * m * m * c.p0.y + 3 * m * m * u * c.p1.y + 3 * m * u * u * c.p2.y + u * u * u * c.p3.y };
}
const bounds = (d: string) => {
  const pts = samples(d);
  return { minX: Math.min(...pts.map((p) => p[0])), maxX: Math.max(...pts.map((p) => p[0])), minY: Math.min(...pts.map((p) => p[1])), maxY: Math.max(...pts.map((p) => p[1])) };
};

describe("Phase 85: the properties", () => {
  it("morph and draw settings are registered for paths and icons only", () => {
    for (const path of ["morph.match", "morph.startOffset", "morph.reverse", "draw.start", "draw.end", "draw.offset", "draw.reverse", "draw.stagger"]) {
      assert.ok(getPropertyDefinition(path), path);
      assert.ok(isPropertyLegalFor(path, "svgPath"), `${path} on a path`);
      assert.ok(isPropertyLegalFor(path, "icon"), `${path} on an icon`);
      assert.equal(isPropertyLegalFor(path, "container"), false, `${path} not on a box`);
    }
    for (const path of ["draw.start", "draw.end", "draw.offset"]) assert.equal(getPropertyDefinition(path)!.animatable, true, `${path} is keyframed`);
    assert.equal(getPropertyDefinition("draw.end")!.default, 1);
  });
  it("a layer drawing its stroke or morphing stays on the kernel, never a Web Animation", () => {
    assert.equal(canRunOnWaapi(["draw.end"]), false);
    assert.equal(canRunOnWaapi(["svg.path"]), false);
    assert.equal(canRunOnWaapi(["appearance.opacity", "draw.end"]), false);
    assert.ok(writesSvgPath(new Set(["draw.offset"])));
    assert.ok(writesSvgPath(new Set(["svg.path"])));
    assert.equal(writesSvgPath(new Set(["appearance.opacity"])), false);
  });
});

describe("Phase 85: morphing with matched points", () => {
  it("the ends of a morph draw the two paths exactly", () => {
    assert.deepEqual(bounds(morphPath(MENU, CLOSE, 0)), bounds(MENU));
    assert.deepEqual(bounds(morphPath(MENU, CLOSE, 1)), bounds(CLOSE));
    assert.equal(morphPath(MENU, CLOSE, 0), "M4 6 C9.333 6 14.667 6 20 6 M4 12 C9.333 12 14.667 12 20 12 M4 18 C9.333 18 14.667 18 20 18");
  });
  it("each sub-path morphs into its partner: a menu's three bars stay three strokes on the way to a cross", () => {
    const mid = morphPath(MENU, CLOSE, 0.5);
    assert.equal(subpathCount(mid), 3);
    assert.equal(mid, "M5 6 C9.667 8 14.333 10 19 12 M8 12 C10.667 12 13.333 12 16 12 M5 18 C9.667 16 14.333 14 19 12");
    // the old solver joined the bars into one run
    assert.notEqual(subpathCount(interpolateValue("path", MENU, CLOSE, 0.5) as string), 3);
  });
  it("a closed shape's start point and direction are matched, so a shape morphing into itself doesn't collapse", () => {
    const [pair] = matchPaths(SQUARE, SQUARE_TURNED)!;
    assert.equal(pair.reversed, true, "the second square is drawn the other way round");
    assert.deepEqual(bounds(morphPath(SQUARE, SQUARE_TURNED, 0.5)), { minX: 0, maxX: 10, minY: 0, maxY: 10 }, "half way it is still the square");
    // as written, every point crosses the middle: the shape shrinks to nothing
    const unmatched = morphPath(SQUARE, SQUARE_TURNED, 0.5, { match: "order" });
    assert.ok(unmatched.startsWith("M5 5 "), `unmatched, opposite corners meet in the middle and the square folds flat: ${unmatched}`);
  });
  it("the manual fixes change the result: a start-point offset and a reversed direction", () => {
    const base = morphPath(SQUARE, SQUARE_TURNED, 0.5);
    assert.notEqual(morphPath(SQUARE, SQUARE_TURNED, 0.5, { startOffset: 1 }), base);
    assert.notEqual(morphPath(SQUARE, SQUARE_TURNED, 0.5, { reverse: true }), base);
    // whatever the fixes, the ends are still the two shapes
    assert.deepEqual(bounds(morphPath(SQUARE, SQUARE_TURNED, 1, { startOffset: 3, reverse: true })), bounds(SQUARE_TURNED));
    assert.deepEqual(bounds(morphPath(SQUARE, SQUARE_TURNED, 0, { startOffset: 3, reverse: true })), bounds(SQUARE));
  });
  it("paths with different point counts are cut to match without changing either", () => {
    const triangle = "M0 0 L10 0 L5 10 Z";
    const [pair] = matchPaths(SQUARE, triangle)!;
    assert.equal(pair.from.length, pair.to.length);
    assert.deepEqual(bounds(morphPath(SQUARE, triangle, 1)), bounds(triangle));
  });
  it("a sub-path with no partner grows from its own centre", () => {
    const one = "M0 0 L10 0";
    const two = "M0 0 L10 0 M0 20 L10 20";
    assert.equal(subpathCount(morphPath(one, two, 0.5)), 2);
    assert.equal(subpathData(morphPath(one, two, 0))[1].replace(/\s+/g, ""), "M520C520520520", "the new stroke starts as a point at its middle");
  });
  it("a path that can't be read holds, and t is clamped", () => {
    assert.equal(morphPath("nonsense", SQUARE, 0.5), "nonsense");
    assert.equal(morphPath("nonsense", SQUARE, 1), SQUARE);
    assert.equal(morphPath(MENU, CLOSE, 7), morphPath(MENU, CLOSE, 1));
    assert.equal(morphPath(MENU, CLOSE, -3), morphPath(MENU, CLOSE, 0));
  });
  it("a layer's settings are read with defaults", () => {
    assert.equal(morphOptions(undefined), MORPH_DEFAULTS);
    assert.equal(morphOptions({ "frame.width": 10 }), MORPH_DEFAULTS);
    assert.deepEqual(morphOptions({ "morph.match": "order", "morph.startOffset": 2.4, "morph.reverse": true }), { match: "order", startOffset: 2, reverse: true });
  });
});

describe("Phase 85: stroke drawing", () => {
  it("the whole stroke needs no dashes; a part of it is one dash on a path of length 1", () => {
    assert.equal(drawDashes(drawSettings(reader({}))), null);
    assert.equal(drawDashes(drawSettings(reader({ "draw.start": 0, "draw.end": 1 }))), null);
    assert.deepEqual(drawDashes(drawSettings(reader({ "draw.end": 0.5 }))), [{ array: "0.5 0.5", offset: 0, from: 0, to: 0.5 }]);
    assert.deepEqual(drawDashes(drawSettings(reader({ "draw.start": 0.25, "draw.end": 0.75 }))), [{ array: "0.5 0.5", offset: -0.25, from: 0.25, to: 0.75 }]);
  });
  it("nothing drawn leaves no dot, even with round caps", () => {
    const [dash] = drawDashes(drawSettings(reader({ "draw.end": 0 })))!;
    assert.equal(dash.array, "0 2");
    assert.ok(dash.offset < -1, "the empty dash sits beyond the path's end");
  });
  it("reverse draws from the other end; an offset slides the drawn part and wraps", () => {
    assert.deepEqual(drawDashes(drawSettings(reader({ "draw.end": 0.25, "draw.reverse": true })))![0], { array: "0.25 0.75", offset: -0.75, from: 0.75, to: 1 });
    assert.equal(drawDashes(drawSettings(reader({ "draw.end": 0.25, "draw.offset": 0.9 })))![0].offset, -0.9);
    assert.ok(drawDashes(drawSettings(reader({ "draw.offset": 0.5 }))), "an offset alone is a drawing (a dashed stroke would slide)");
  });
  it("without a stagger every sub-path draws together; with one they draw one after another", () => {
    const together = drawDashes(drawSettings(reader({ "draw.end": 0.5 })), 3)!;
    assert.deepEqual(together.map((d) => d.to), [0.5, 0.5, 0.5]);
    const inTurn = drawDashes(drawSettings(reader({ "draw.end": 0.5, "draw.stagger": 1 })), 3)!;
    assert.deepEqual(inTurn.map((d) => d.to), [1, 0.5, 0]);
    // at the end every sub-path is whole, at the start none is
    assert.equal(drawDashes(drawSettings(reader({ "draw.end": 1, "draw.stagger": 1 })), 3), null);
    assert.deepEqual(drawDashes(drawSettings(reader({ "draw.end": 0, "draw.stagger": 0.5 })), 3)!.map((d) => d.to), [0, 0, 0]);
    assert.equal(staggered(0.5, 0, 1, 1), 0.5, "one sub-path has nothing to stagger");
  });
  it("values out of range are clamped", () => {
    const s = drawSettings(reader({ "draw.start": -2, "draw.end": 9, "draw.stagger": 4, "draw.offset": "x" }));
    assert.deepEqual(s, { start: 0, end: 1, offset: 0, reverse: false, stagger: 1 });
    assert.equal(hasDraw({ "draw.end": 1 }), true);
    assert.equal(hasDraw({ "svg.path": MENU }), false);
  });
});

const pathLayer = (id: string, properties: Record<string, unknown>, archetype: "svgPath" | "icon" = "svgPath") => createLayer({ id, archetype, parentId: null, properties: { "frame.width": 200, "frame.height": 200, ...properties } as Layer["properties"] }) as Layer;

/** The references the phase is done by: a menu icon morphing into a close icon, and a logo drawing itself. */
const iconMorph = (extra: Record<string, unknown> = {}): MotionDocument => {
  const clip = attachClip(hydrateClip({ name: "Morph", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property: "svg.path", keyframes: [{ time: 0, value: MENU }, { time: 1, value: CLOSE }] }] }), "icon");
  return createDocumentFromLayers([pathLayer("icon", { "svg.path": MENU, ...extra }, "icon")], [clip]);
};
const LOGO = "M20 20 L180 20 L180 180 L20 180 Z M60 60 L140 60 M60 100 L140 100 M60 140 L140 140";
const logoDraw = (): MotionDocument => {
  const clip = attachClip(hydrateClip({ name: "Draw", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property: "draw.end", keyframes: [{ time: 0, value: 0 }, { time: 1, value: 1 }] }] }), "logo");
  return createDocumentFromLayers([pathLayer("logo", { "svg.path": LOGO, "draw.start": 0, "draw.end": 1, "draw.stagger": 0.5 })], [clip]);
};

describe("Phase 85: the kernel", () => {
  it("the icon-morph reference: evaluate() gives the matched morph at five times", () => {
    const doc = iconMorph();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.equal(evaluate(doc, "comp_main", "icon", t)["svg.path"], t === 0 ? MENU : t === 1 ? CLOSE : morphPath(MENU, CLOSE, t), `at ${t}`);
    assert.equal(subpathCount(evaluate(doc, "comp_main", "icon", 0.5)["svg.path"] as string), 3);
  });
  it("the layer's morph settings change what evaluate() gives", () => {
    const clip = (id: string) => attachClip(hydrateClip({ name: "Morph", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property: "svg.path", keyframes: [{ time: 0, value: SQUARE }, { time: 1, value: SQUARE_TURNED }] }] }), id);
    const doc = createDocumentFromLayers([pathLayer("a", { "svg.path": SQUARE }), pathLayer("b", { "svg.path": SQUARE, "morph.match": "order" })], [clip("a"), clip("b")]);
    assert.equal(evaluate(doc, "comp_main", "a", 0.5)["svg.path"], morphPath(SQUARE, SQUARE_TURNED, 0.5));
    assert.equal(evaluate(doc, "comp_main", "b", 0.5)["svg.path"], morphPath(SQUARE, SQUARE_TURNED, 0.5, { match: "order" }));
    assert.notEqual(evaluate(doc, "comp_main", "a", 0.5)["svg.path"], evaluate(doc, "comp_main", "b", 0.5)["svg.path"]);
  });
  it("the logo-draw reference: evaluate() gives the drawn length, and the layer is planned for the path writer", () => {
    const doc = logoDraw();
    for (const t of [0, 0.25, 0.5, 0.75, 1]) assert.equal(evaluate(doc, "comp_main", "logo", t)["draw.end"], t, `at ${t}`);
    assert.ok(animatedPaths(doc, "logo").has("draw.end"));
  });
});

/** A stand-in for an SVG element: attributes, children, and the two queries the writer uses. */
class FakeEl {
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  isConnected = true;
  style = { values: new Map<string, string>(), setProperty(n: string, v: string) { this.values.set(n, v); }, removeProperty(n: string) { this.values.delete(n); return ""; }, getPropertyValue(n: string) { return this.values.get(n) ?? ""; } };
  constructor(readonly tag: string, attrs: Record<string, string> = {}, children: FakeEl[] = []) {
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
    this.children = children;
  }
  getAttribute(n: string) { return this.attrs.has(n) ? this.attrs.get(n)! : null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  removeAttribute(n: string) { this.attrs.delete(n); }
  matches(sel: string) { return sel === this.tag; }
  private all(): FakeEl[] { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelectorAll(sel: string) { const attr = /\[(.+)\]/.exec(sel)?.[1]; return this.all().filter((e) => e.tag === "path" && (!attr || e.attrs.has(attr))); }
  querySelector(sel: string) { return this.querySelectorAll(sel)[0] ?? null; }
}

describe("Phase 85: the engine writes the path and the dashes", () => {
  it("the icon-morph reference: the drawn path is evaluate()'s at five times, and leaving puts the icon back", () => {
    const doc = iconMorph();
    const path = new FakeEl("path", { d: MENU });
    const root = new FakeEl("svg", {}, [path]);
    const adapter = new KernelAdapter();
    adapter.mount({ node: () => root as unknown as Element, getDocument: () => doc, compositionId: () => "comp_main", fps: () => 60, duration: () => 1 });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      adapter.seek(t);
      assert.equal(path.getAttribute("d"), evaluate(doc, "comp_main", "icon", t)["svg.path"], `at ${t}`);
    }
    assert.equal(path.getAttribute("pathLength"), null, "no drawing settings: no dashes");
    adapter.dispose();
    assert.equal(path.getAttribute("d"), MENU);
  });
  it("the logo-draw reference: each sub-path's dash is the kernel's at five times, staggered", () => {
    const doc = logoDraw();
    const parts = subpathData(LOGO).map((d, i) => new FakeEl("path", { d, "data-path-part": String(i), "stroke-dasharray": "none" }));
    const fill = new FakeEl("path", { d: LOGO, "data-path-fill": "" });
    const root = new FakeEl("svg", {}, [new FakeEl("g", {}, [fill, ...parts])]);
    const adapter = new KernelAdapter();
    adapter.mount({ node: () => root as unknown as Element, getDocument: () => doc, compositionId: () => "comp_main", fps: () => 60, duration: () => 1 });
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      adapter.seek(t);
      const expected = drawDashes(drawSettings((p) => evaluate(doc, "comp_main", "logo", t)[p]), parts.length);
      parts.forEach((part, i) => {
        assert.equal(part.getAttribute("stroke-dasharray"), expected ? expected[i].array : "none", `dashes of sub-path ${i} at ${t}`);
        assert.equal(part.getAttribute("pathLength"), expected ? "1" : null, `length of sub-path ${i} at ${t}`);
      });
    }
    // half way, with the stagger: the first sub-path is ahead of the last
    adapter.seek(0.5);
    const lengths = parts.map((p) => Number(p.getAttribute("stroke-dasharray")!.split(" ")[0]));
    assert.ok(lengths[0] > lengths[3], `the outline (${lengths[0]}) is further on than the last bar (${lengths[3]})`);
    assert.equal(fill.getAttribute("pathLength"), null, "the fill is never dashed");
    adapter.dispose();
    for (const part of parts) {
      assert.equal(part.getAttribute("stroke-dasharray"), "none", "what React drew is put back");
      assert.equal(part.getAttribute("pathLength"), null);
      assert.equal(part.getAttribute("stroke-dashoffset"), null);
    }
  });
  it("only changed attributes are written, and a morph with more sub-paths than were drawn keeps them all", () => {
    const writer = new SvgPathWriter();
    const parts = [new FakeEl("path", { d: "M0 0L1 1", "data-path-part": "0" }), new FakeEl("path", { d: "M2 2L3 3", "data-path-part": "1" })];
    const root = new FakeEl("svg", {}, parts);
    const resolved = { "svg.path": "M0 0 L1 1 M2 2 L3 3 M4 4 L5 5", "draw.end": 0.5 };
    writer.sync(root as unknown as Element, "l", new Set(["svg.path", "draw.end"]), resolved);
    assert.equal(subpathCount(parts[1].getAttribute("d")!), 2, "the last element draws the rest");
    const writes = writer.writes;
    writer.sync(root as unknown as Element, "l", new Set(["svg.path", "draw.end"]), resolved);
    assert.equal(writer.writes, writes, "the same frame again writes nothing");
  });
});

describe("Phase 85: the render definition", () => {
  const draw = (layer: Layer) => renderToStaticMarkup(createElement(RenderLayer, { layerId: layer.id, layers: createDocumentFromLayers([layer]).layers }));
  it("a path with no drawing settings is the one path element it always was", () => {
    const html = draw(pathLayer("p", { "svg.path": MENU }));
    assert.equal(html.match(/<path/g)!.length, 1);
    assert.ok(!html.includes("pathLength") && !html.includes("data-path-part"));
  });
  it("a stroke drawn half way at rest is one dash on a path of length 1", () => {
    const html = draw(pathLayer("p", { "svg.path": "M0 0 L100 100", "draw.end": 0.5 }));
    assert.ok(html.includes('pathLength="1"'), html);
    assert.ok(html.includes('stroke-dasharray="0.5 0.5"'), html);
  });
  it("several sub-paths with drawing settings are a fill and one stroke each, so they can draw together", () => {
    const html = draw(pathLayer("p", { "svg.path": MENU, "svg.fill": "#ff0000", "draw.end": 0.5 }));
    assert.equal(html.match(/data-path-part=/g)!.length, 3);
    assert.equal(html.match(/data-path-fill/g)!.length, 1);
    assert.equal(html.match(/stroke-dasharray="0.5 0.5"/g)!.length, 3);
    const whole = draw(pathLayer("p", { "svg.path": MENU, "draw.start": 0, "draw.end": 1 }));
    assert.equal(whole.match(/data-path-part=/g)!.length, 3, "split even when the whole stroke shows, ready for the engine");
    assert.ok(!whole.includes("pathLength"));
  });
  it("an icon draws its stroke the same way", () => {
    const html = draw(pathLayer("i", { "svg.path": MENU, "draw.end": 0.5, "draw.stagger": 1 }, "icon"));
    assert.equal(html.match(/data-path-part=/g)!.length, 3);
    assert.ok(html.includes('stroke-dasharray="1 0"') && html.includes('stroke-dasharray="0.5 0.5"') && html.includes('stroke-dasharray="0 2"'), html);
  });
});

describe("Phase 85: the commands", () => {
  const fresh = () => {
    setDocument(createDocumentFromLayers([pathLayer("a", { "svg.path": MENU }), pathLayer("b", { "svg.path": CLOSE }), pathLayer("i", { "svg.path": MENU }, "icon"), createLayer({ id: "box", archetype: "container", parentId: null, properties: {} }) as Layer], []));
    return registerPathMotionCommands();
  };
  const p = (id = "a") => getDocument().layers[id].properties;
  const track = (id: string, property: string) => Object.values(getDocument().clips).filter((c) => c.layerId === id).flatMap((c) => c.tracks).find((t) => t.property === property);

  it("path.setDraw sets and clears the drawing; one undo step; a box is left alone", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("path.setDraw", { ids: ["a", "box"], end: 0.4, stagger: 0.5, reverse: true }), true);
      assert.equal(p()["draw.end"], 0.4);
      assert.equal(p()["draw.stagger"], 0.5);
      assert.equal(p()["draw.reverse"], true);
      assert.equal(p("box")["draw.end"], undefined);
      historyCommands.undo();
      assert.equal(p()["draw.end"], undefined);
      invokeCommand("path.setDraw", { ids: ["a"], end: 0.4 });
      invokeCommand("path.setDraw", { ids: ["a"], clear: true });
      assert.equal(hasDraw(p()), false);
    } finally { off(); }
  });
  it("path.setMorph sets the matching", () => {
    const off = fresh();
    try {
      invokeCommand("path.setMorph", { ids: ["a"], match: "order", startOffset: 2, reverse: true });
      assert.deepEqual(morphOptions(p()), { match: "order", startOffset: 2, reverse: true });
    } finally { off(); }
  });
  it("path.animateDraw keys the stroke from nothing to whole, and leaves the layer whole at rest; one undo step", () => {
    const off = fresh();
    try {
      const out = runCommand("path.animateDraw", { ids: ["a"], duration: 0.5, at: 0 }) as { ok: boolean };
      assert.equal(out.ok, true);
      const t = track("a", "draw.end")!;
      assert.deepEqual(t.keyframes.map((k) => [k.time, k.value]), [[0, 0], [0.5, 1]]);
      assert.equal(p()["draw.end"], 1);
      assert.equal(evaluate(getDocument(), "comp_main", "a", 0.25)["draw.end"], 0.5);
      historyCommands.undo();
      assert.equal(track("a", "draw.end"), undefined);
      assert.equal(hasDraw(p()), false);
      assert.equal((runCommand("path.animateDraw", { ids: ["box"] }) as { ok: boolean; code: string }).code, "NO_PATH");
    } finally { off(); }
  });
  it("path.morphTo keys the layer's path into another layer's; refuses a different kind of layer", () => {
    const off = fresh();
    try {
      const out = runCommand("path.morphTo", { id: "a", source: "b", duration: 1, at: 0 }) as { ok: boolean };
      assert.equal(out.ok, true);
      assert.deepEqual(track("a", "svg.path")!.keyframes.map((k) => [k.time, k.value]), [[0, MENU], [1, CLOSE]]);
      assert.equal(evaluate(getDocument(), "comp_main", "a", 0.5)["svg.path"], morphPath(MENU, CLOSE, 0.5));
      assert.equal((runCommand("path.morphTo", { id: "a", source: "i" }) as { code: string }).code, "DIFFERENT_KIND");
      assert.equal((runCommand("path.morphTo", { id: "a", source: "a" }) as { code: string }).code, "BAD_SOURCE");
      assert.equal((runCommand("path.morphTo", { id: "a", path: "nonsense" }) as { code: string }).code, "BAD_PATH");
      assert.equal((runCommand("path.morphTo", { id: "box", source: "b" }) as { code: string }).code, "NO_PATH");
    } finally { off(); }
  });
});
