import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DocBuilder } from "../../../document/__tests__/fixtures/builder";
import { MultiEngineAnimationRuntimeService, multiEngineAnimationRuntime } from "../../../engine/MultiEngineAnimationRuntime";
import { compileGsapTimeline, mapPropertyToGsap } from "../gsap";
import { compileFramerMotionVariants, mapPropertyToFramer } from "../framer";
import { generateCssKeyframes, generateCssLinearSpring, mapPropertyToCss } from "../css";
import { planMotionExport } from "../plan";
import { SAMPLES, TRACK_IDS } from "./_matrix";
import golden from "./golden.json";

/** ROADMAP Phase 94: the engine generators moved out of the runtime unchanged, and the export plan reads the document only. */
const expected = golden as Record<string, unknown>;

describe("Phase 94: the generators emit what the runtime emitted before they moved", () => {
  // golden.json was made from the runtime as it was before the move (106 outputs); the generators and the runtime's own methods must both equal it
  const fromFunctions = (): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const id of TRACK_IDS) { out[`gsap:${id}`] = mapPropertyToGsap(id); out[`framer:${id}`] = mapPropertyToFramer(id); out[`css:${id}`] = mapPropertyToCss(id); }
    for (const s of SAMPLES) {
      out[`gsap:${s.id}`] = compileGsapTimeline(s);
      out[`gsap-sel:${s.id}`] = compileGsapTimeline(s, { componentSelector: ".card", scrollTrigger: { trigger: ".card", start: "top 80%", end: "bottom 20%", scrub: true, pin: true, markers: true }, useReactHook: true });
      out[`gsap-scrub:${s.id}`] = compileGsapTimeline(s, { scrollTrigger: { scrub: 0.5 } });
      out[`framer:${s.id}`] = compileFramerMotionVariants(s);
      out[`framer-spring:${s.id}`] = compileFramerMotionVariants(s, { springConfig: { stiffness: 120, damping: 14, mass: 2 }, reducedMotion: true });
      out[`css-kf:${s.id}`] = generateCssKeyframes(`${s.id}-anim`, s.tracks);
    }
    for (const [k, d, m, p] of [[350, 22, 1, 24], [100, 10, 1, 12], [200, 40, 2, 30], [undefined, undefined, undefined, undefined]] as Array<Array<number | undefined>>) out[`spring:${k}:${d}:${m}:${p}`] = generateCssLinearSpring(k, d, m, p);
    return out;
  };
  const fromRuntime = (r: MultiEngineAnimationRuntimeService): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    const x = r as unknown as Record<string, (...a: unknown[]) => unknown>;
    for (const id of TRACK_IDS) { out[`gsap:${id}`] = r.mapPropertyToGsap(id); out[`framer:${id}`] = x["mapPropertyToFramer"](id); out[`css:${id}`] = x["mapPropertyToCss"](id); }
    for (const s of SAMPLES) {
      out[`gsap:${s.id}`] = r.compileGsapTimeline(s);
      out[`gsap-sel:${s.id}`] = r.compileGsapTimeline(s, { componentSelector: ".card", scrollTrigger: { trigger: ".card", start: "top 80%", end: "bottom 20%", scrub: true, pin: true, markers: true }, useReactHook: true });
      out[`gsap-scrub:${s.id}`] = r.compileGsapTimeline(s, { scrollTrigger: { scrub: 0.5 } });
      out[`framer:${s.id}`] = r.compileFramerMotionVariants(s);
      out[`framer-spring:${s.id}`] = r.compileFramerMotionVariants(s, { springConfig: { stiffness: 120, damping: 14, mass: 2 }, reducedMotion: true });
      out[`css-kf:${s.id}`] = r.generateCssKeyframes(`${s.id}-anim`, s.tracks);
    }
    for (const [k, d, m, p] of [[350, 22, 1, 24], [100, 10, 1, 12], [200, 40, 2, 30], [undefined, undefined, undefined, undefined]] as Array<Array<number | undefined>>) out[`spring:${k}:${d}:${m}:${p}`] = r.generateCssLinearSpring(k, d, m, p);
    return out;
  };
  it("the functions give every one of the 106 outputs of the old runtime", () => {
    const got = fromFunctions();
    assert.equal(Object.keys(expected).length, 106);
    for (const k of Object.keys(expected)) assert.deepEqual(got[k], expected[k], k);
  });
  it("and so does the runtime, which now calls them", () => {
    const got = fromRuntime(multiEngineAnimationRuntime);
    for (const k of Object.keys(expected)) assert.deepEqual(got[k], expected[k], k);
  });
});

describe("Phase 94: exporters read the document and routing only", () => {
  const dir = join(process.cwd(), "src/core/export/motion");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  it("no file in the folder imports a store, the editor, React, or touches the page", () => {
    assert.ok(files.length >= 6);
    for (const f of files) {
      const src = readFileSync(join(dir, f), "utf8");
      for (const m of src.matchAll(/^\s*(?:import|export)[^;]*?from\s+["']([^"']+)["']/gm)) {
        const spec = m[1];
        assert.ok(!/store|@\/editor|legacy-editor|\/editor\/|zustand|react|next\//.test(spec), `${f} imports ${spec}`);
      }
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "").replace(/`[\s\S]*?`/g, "``");
      assert.ok(!/\b(window|document|localStorage|navigator)\./.test(code), `${f} touches the browser`);
    }
  });
});

describe("Phase 94: the plan", () => {
  const track = (property: string) => ({ id: `t_${property}`, property, keyframes: [{ id: `${property}_a`, time: 0, value: 0, ease: "linear" }, { id: `${property}_b`, time: 1, value: 1, ease: "linear" }] });
  const build = () => {
    const b = new DocBuilder();
    const card = b.layer("container", "Card", null, {});
    b.clip(card, { name: "Fade", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("appearance.opacity")] });
    b.clip(card, { name: "Pop", type: "entrance", trigger: "mount", duration: 1, easing: "spring(stiffness: 300, damping: 20)", tracks: [track("transform.scale")] });
    b.clip(card, { name: "Hover", type: "hover", trigger: "hover", duration: 0.3, easing: "ease-out", tracks: [track("transform.y")] });
    b.clip(card, { name: "Off", type: "entrance", trigger: "mount", duration: 1, easing: "linear", enabled: false, tracks: [track("appearance.opacity")] });
    const logo = b.layer("svgPath", "Logo", null, {});
    b.clip(logo, { name: "Draw", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("svg.strokeDashoffset")] });
    const orb = b.layer("container", "Orb", null, {});
    b.clip(orb, { name: "Spin3D", type: "loop", trigger: "mount", duration: 2, easing: "linear", tracks: [track("scene3d.rotation")] });
    return b.build();
  };
  it("picks css for a timed fade, motion for a spring and a hover, svg for stroke drawing", () => {
    const plan = planMotionExport(build());
    const by = Object.fromEntries(plan.entries.map((e) => [e.clipName, e.engine]));
    assert.equal(by["Fade"], "css");
    assert.equal(by["Pop"], "motion");
    assert.equal(by["Hover"], "motion");
    assert.equal(by["Draw"], "svg");
    assert.equal(by["Off"], undefined, "a disabled clip is not exported");
    assert.deepEqual(plan.engines, ["css", "motion", "svg"], "what a README lists, in a fixed order");
  });
  it("lists what it can't export, with the reason, and doesn't drop it silently", () => {
    const plan = planMotionExport(build());
    assert.equal(plan.skipped.length, 1);
    assert.equal(plan.skipped[0].clipName, "Spin3D");
    assert.match(plan.skipped[0].reason, /not exported/);
  });
  it("GSAP is used only when asked for, and never for SVG", () => {
    const doc = build();
    assert.ok(!planMotionExport(doc).entries.some((e) => e.engine === "gsap"));
    const g = planMotionExport(doc, { gsap: true });
    assert.equal(g.entries.find((e) => e.clipName === "Fade")?.engine, "gsap");
    assert.equal(g.entries.find((e) => e.clipName === "Draw")?.engine, "svg");
    assert.ok(g.engines.includes("gsap"));
  });
  it("is the same every time, and every entry says why", () => {
    const doc = build();
    assert.deepEqual(planMotionExport(doc), planMotionExport(doc));
    for (const e of planMotionExport(doc).entries) assert.ok(e.reason.length > 20 && e.properties.length > 0);
  });
  it("an empty document has an empty plan", () => {
    assert.deepEqual(planMotionExport(new DocBuilder().build()), { entries: [], skipped: [], engines: [] });
  });
});
