import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attachClip, createDocumentFromLayers, createLayer, hydrateClip } from "../../document/factories";
import type { Layer, MotionDocument } from "../../document/schema";
import { getPropertyDefinition } from "../../document/properties";
import { evaluate } from "../../kernel/evaluate";
import { animatedLayers, animatedPaths, styleWrites } from "../../engine/stage/styleWrites";
import { canRunOnWaapi } from "../../engine/stage/waapiEligibility";
import { invokeCommand, tryRunCommand } from "../../commands";
import { setDocument } from "../../store/documentState";
import { getDocument, historyCommands } from "../../store/useDocumentStore";
import { followsPath, pathSampler } from "../pathFollow";
import { EFFECT_ROUTES, MOTION_BLUR_ROUTE, PERFORMANCE_NOTES, effectPerformance, performanceOf, type RoutedEffect } from "../../rules/effectRouting";
import { registerPathMotionCommands } from "../pathMotionCommands";

/** ROADMAP Phase 86: a layer travelling along a path at constant speed. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; code?: string };
const close = (a: number, b: number, eps: number, what: string) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);

/** A circle of radius 80 about (100, 100), as four cubic quarter turns, starting at the right and going clockwise on screen. */
const K = 80 * 0.5522847498307936;
const CIRCLE = `M180 100 C180 ${100 + K} ${100 + K} 180 100 180 C${100 - K} 180 20 ${100 + K} 20 100 C20 ${100 - K} ${100 - K} 20 100 20 C${100 + K} 20 180 ${100 - K} 180 100 Z`;
/** A short side then a long one: the path's own parameter would spend half its time on each. */
const ELL = "M0 0 L10 0 L10 90";

describe("Phase 86: the arc-length sampler", () => {
  it("equal steps of the share are equal distances, whatever the segments", () => {
    const s = pathSampler(ELL)!;
    assert.equal(s.length, 100);
    assert.deepEqual(s.at(0), { x: 0, y: 0, angle: 0 });
    assert.deepEqual(s.at(0.05), { x: 5, y: 0, angle: 0 });
    // a tenth of the way is the corner; half way is 40 down the long side, not at the corner
    assert.deepEqual(s.at(0.5), { x: 10, y: 40, angle: 90 });
    assert.deepEqual(s.at(1), { x: 10, y: 90, angle: 90 });
    let last = s.at(0);
    for (let i = 1; i <= 20; i++) {
      const p = s.at(i / 20);
      close(Math.abs(p.x - last.x) + Math.abs(p.y - last.y), 5, 1e-9, `step ${i}`);
      last = p;
    }
  });
  it("a circle is measured to within a twentieth of a pixel and travelled at constant speed", () => {
    const s = pathSampler(CIRCLE)!;
    close(s.length, 2 * Math.PI * 80, 0.2, "the circumference");
    assert.equal(s.closed, true);
    for (const share of [0, 0.125, 0.25, 0.5, 0.75, 0.9]) {
      const p = s.at(share);
      close(Math.hypot(p.x - 100, p.y - 100), 80, 0.05, `on the circle at ${share}`);
      // the angle travelled about the centre is the share of a turn
      const turned = ((Math.atan2(p.y - 100, p.x - 100) * 180) / Math.PI + 360) % 360;
      close(turned, share * 360, 0.2, `the turn at ${share}`);
      // the direction of travel is a quarter turn on from the radius
      close(((p.angle - turned + 540) % 360) - 180, 90, 4, `the direction at ${share}`);
    }
  });
  it("a closed path goes round again past its end; an open one stops", () => {
    const circle = pathSampler(CIRCLE)!;
    close(circle.at(1.25).y, circle.at(0.25).y, 1e-9, "a quarter of the second lap");
    close(circle.at(-0.25).x, circle.at(0.75).x, 1e-9, "backwards");
    const ell = pathSampler(ELL)!;
    assert.deepEqual(ell.at(7), ell.at(1));
    assert.deepEqual(ell.at(-3), ell.at(0));
  });
  it("the path is scaled before it is measured; a path with no length gives no sampler", () => {
    const s = pathSampler(ELL, 2, 0.5)!;
    assert.equal(s.length, 20 + 45);
    assert.deepEqual(s.at(1), { x: 20, y: 45, angle: 90 });
    assert.equal(pathSampler("M5 5"), null);
    assert.equal(pathSampler("nonsense"), null);
  });
});

const ROOT = "root";
const scene = (layers: Layer[], clips: ReturnType<typeof attachClip>[] = []): MotionDocument =>
  createDocumentFromLayers([createLayer({ id: ROOT, archetype: "container", parentId: null, children: layers.map((l) => l.id), properties: { "frame.width": 800, "frame.height": 600 } }) as Layer, ...layers], clips);
const free = (id: string, archetype: "container" | "svgPath", properties: Record<string, unknown>) => createLayer({ id, archetype, parentId: ROOT, properties: { positioning: "absolute", ...properties } as Layer["properties"] }) as Layer;
const travel = (layerId: string, property = "motionPath.progress", from = 0, to = 1) => attachClip(hydrateClip({ name: "Travel", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [{ property, keyframes: [{ time: 0, value: from }, { time: 1, value: to }] }] }), layerId);

/** The reference the phase is done by: a dot orbiting a circle drawn on the page. */
const orbit = (extra: Record<string, unknown> = {}, track: Record<string, unknown> = {}): MotionDocument =>
  scene([free("track", "svgPath", { "frame.x": 300, "frame.y": 100, "frame.width": 200, "frame.height": 200, "svg.path": CIRCLE, ...track }), free("dot", "container", { "frame.x": 40, "frame.y": 60, "frame.width": 20, "frame.height": 20, "motionPath.source": "track", ...extra })], [travel("dot")]);

describe("Phase 86: the kernel puts the layer on its path", () => {
  it("the orbit reference: at five times the layer's centre is on the drawn circle, at that share of a turn", () => {
    const doc = orbit();
    const sampler = pathSampler(CIRCLE)!;
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const r = evaluate(doc, "comp_main", "dot", t);
      const at = sampler.at(t);
      // the track is drawn at (300, 100); the dot rests with its centre at (50, 70)
      close(r["transform.x"] as number, 300 + at.x - 50, 0.001, `x at ${t}`);
      close(r["transform.y"] as number, 100 + at.y - 70, 0.001, `y at ${t}`);
      const centre = { x: 50 + (r["transform.x"] as number), y: 70 + (r["transform.y"] as number) };
      close(Math.hypot(centre.x - 400, centre.y - 200), 80, 0.05, `on the circle at ${t}`);
      assert.equal(typeof r.transform, "string", "the single transform carries the move");
    }
    assert.equal(evaluate(doc, "comp_main", "dot", 0.5)["transform.rotate"], undefined, "it doesn't turn unless asked");
  });
  it("turning along the path adds the direction of travel, and a turn offset on top", () => {
    const sampler = pathSampler(CIRCLE)!;
    const turned = evaluate(orbit({ "motionPath.autoRotate": true }), "comp_main", "dot", 0.25);
    close(turned["transform.rotate"] as number, sampler.at(0.25).angle, 0.001, "faces the way it travels");
    const offset = evaluate(orbit({ "motionPath.autoRotate": true, "motionPath.rotate": 90, "transform.rotate": 10 }), "comp_main", "dot", 0.25);
    close(offset["transform.rotate"] as number, sampler.at(0.25).angle + 100, 0.001, "plus the offset and its own rotation");
    assert.equal(evaluate(orbit({ "motionPath.rotate": 30 }), "comp_main", "dot", 0.25)["transform.rotate"], 30);
  });
  it("an offset moves a second layer ahead on the same path", () => {
    const ahead = evaluate(orbit({ "motionPath.offset": 0.25 }), "comp_main", "dot", 0.25);
    const plain = evaluate(orbit(), "comp_main", "dot", 0.5);
    assert.equal(ahead["transform.x"], plain["transform.x"]);
    assert.equal(ahead["transform.y"], plain["transform.y"]);
  });
  it("the path's frame stretches it, and a path that moves carries its follower", () => {
    const wide = evaluate(orbit({}, { "frame.width": 400 }), "comp_main", "dot", 0);
    close(wide["transform.x"] as number, 300 + 360 - 50, 0.001, "the circle is an ellipse twice as wide");
    const still = evaluate(orbit(), "comp_main", "dot", 0.5);
    const doc = orbit();
    const moved = scene(Object.values(doc.layers).filter((l) => l.id !== ROOT), [...Object.values(doc.clips), travel("track", "transform.x", 0, 120)]);
    close((evaluate(moved, "comp_main", "dot", 0.5)["transform.x"] as number) - (still["transform.x"] as number), 60, 0.001, "half way, the path has moved 60 and so has the dot");
  });
  it("a path of the layer's own is followed from where the layer rests", () => {
    const doc = scene([free("a", "container", { "frame.x": 10, "frame.y": 10, "frame.width": 20, "frame.height": 20, "transform.motionPath": ELL, "transform.x": 3 })], [travel("a")]);
    const r = evaluate(doc, "comp_main", "a", 0.5);
    assert.equal(r["transform.x"], 13);
    assert.equal(r["transform.y"], 40);
  });
  it("a layer in a flow layout, a missing source and a layer with no path are left alone", () => {
    const flow = scene([free("track", "svgPath", { "frame.width": 200, "frame.height": 200, "svg.path": CIRCLE }), createLayer({ id: "dot", archetype: "container", parentId: ROOT, properties: { "frame.width": 20, "frame.height": 20, "motionPath.source": "track" } }) as Layer], [travel("dot")]);
    assert.equal(evaluate(flow, "comp_main", "dot", 0.5)["transform.x"], undefined);
    const gone = scene([free("dot", "container", { "frame.width": 20, "frame.height": 20, "motionPath.source": "nowhere" })], [travel("dot")]);
    assert.equal(evaluate(gone, "comp_main", "dot", 0.5)["transform.x"], undefined);
    assert.equal(followsPath({ "frame.width": 20 }), false);
    assert.equal(followsPath({ "motionPath.source": "track" }), true);
    assert.equal(followsPath({ "transform.motionPath": ELL }), true);
  });
});

describe("Phase 86: the engine", () => {
  it("a layer on a path is planned, its transform is written every frame, and it never runs as a Web Animation", () => {
    const doc = orbit();
    assert.ok(animatedPaths(doc, "dot").has("transform.x"));
    assert.ok(animatedLayers(doc).has("dot"));
    assert.equal(canRunOnWaapi(animatedPaths(doc, "dot")), false);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const r = evaluate(doc, "comp_main", "dot", t);
      const written = styleWrites(animatedPaths(doc, "dot"), r, "dot").transform;
      assert.equal(written, r.transform, `the written transform at ${t}`);
      assert.ok(written.length > 0 && written !== "none");
    }
    // a layer placed on a path with no keyframes at all is still drawn there
    const placed = scene([free("track", "svgPath", { "frame.width": 200, "frame.height": 200, "svg.path": CIRCLE }), free("dot", "container", { "frame.width": 20, "frame.height": 20, "motionPath.source": "track", "motionPath.progress": 0.5 })]);
    assert.ok(animatedLayers(placed).has("dot"));
  });
  it("the properties are registered, and the path itself is not written as CSS", () => {
    for (const path of ["motionPath.source", "motionPath.progress", "motionPath.offset", "motionPath.autoRotate", "motionPath.rotate"]) assert.ok(getPropertyDefinition(path), path);
    assert.equal(getPropertyDefinition("motionPath.progress")!.animatable, true);
    assert.equal(getPropertyDefinition("transform.motionPath")!.css, null);
  });
});

describe("Phase 86: the commands", () => {
  const fresh = () => {
    setDocument(scene([free("track", "svgPath", { "frame.width": 200, "frame.height": 200, "svg.path": CIRCLE }), free("dot", "container", { "frame.width": 20, "frame.height": 20 })]));
    return registerPathMotionCommands();
  };
  const p = () => getDocument().layers.dot.properties;
  const track = () => Object.values(getDocument().clips).filter((c) => c.layerId === "dot").flatMap((c) => c.tracks).find((t) => t.property === "motionPath.progress");

  it("path.follow puts a layer on a path layer, sets how it travels, and takes it off; one undo step each", () => {
    const off = fresh();
    try {
      assert.equal(invokeCommand("path.follow", { ids: ["dot"], source: "track", autoRotate: true, offset: 0.25 }), true);
      assert.equal(p()["motionPath.source"], "track");
      assert.equal(p()["motionPath.autoRotate"], true);
      assert.equal(p()["motionPath.offset"], 0.25);
      historyCommands.undo();
      assert.equal(followsPath(p()), false);
      invokeCommand("path.follow", { ids: ["dot"], source: "track", progress: 0.5 });
      invokeCommand("path.follow", { ids: ["dot"], source: null });
      assert.equal(followsPath(p()), false);
      assert.equal(p()["motionPath.progress"], undefined);
    } finally { off(); }
  });
  it("it refuses a layer that is not a path, a path following itself, and path data that can't be read", () => {
    const off = fresh();
    try {
      assert.equal(run("path.follow", { ids: ["track"], source: "dot" }).code, "BAD_SOURCE");
      assert.equal(run("path.follow", { ids: ["track"], source: "track" }).code, "SELF");
      assert.equal(run("path.follow", { ids: ["dot"], path: "nonsense" }).code, "BAD_PATH");
      assert.equal(run("path.follow", { ids: ["dot"], path: ELL }).ok, true);
      assert.equal(p()["transform.motionPath"], ELL);
    } finally { off(); }
  });
  it("path.animateFollow keys the journey from start to end; refused off a path; one undo step", () => {
    const off = fresh();
    try {
      assert.equal(run("path.animateFollow", { ids: ["dot"] }).code, "NO_PATH");
      invokeCommand("path.follow", { ids: ["dot"], source: "track" });
      assert.equal(run("path.animateFollow", { ids: ["dot"], duration: 2, at: 0 }).ok, true);
      assert.deepEqual(track()!.keyframes.map((k) => [k.time, k.value]), [[0, 0], [2, 1]]);
      const half = evaluate(getDocument(), "comp_main", "dot", 1);
      close(half["transform.x"] as number, pathSampler(CIRCLE)!.at(0.5).x - 10, 0.001, "half way round after a second");
      historyCommands.undo();
      assert.equal(track(), undefined);
    } finally { off(); }
  });
});

describe("Phase 86: every effect has a performance class", () => {
  it("a CSS filter is cheap to animate, an SVG filter repaints the layer", () => {
    for (const type of Object.keys(EFFECT_ROUTES) as RoutedEffect[]) {
      assert.equal(effectPerformance(type), EFFECT_ROUTES[type].backend === "css" ? "compositor" : "repaint", type);
      assert.ok(PERFORMANCE_NOTES[effectPerformance(type)].length > 20);
    }
    assert.equal(effectPerformance("blur"), "compositor");
    assert.equal(effectPerformance("displacement"), "repaint");
    assert.equal(effectPerformance("noise"), "repaint");
    assert.equal(performanceOf(MOTION_BLUR_ROUTE), "repaint");
  });
});
