import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { createDocumentFromLayers, createLayer } from "../../../document/factories";
import type { Layer } from "../../../document/schema";
import { BindingSchema, parseBinding, resolveLayerRefs, type Binding } from "../../../document/signals";
import { busFrame as coreBusFrame, newBusState, type InputSource } from "../../../bindings/inputBus";
import { createBindingRuntime, type BindingHost } from "../../../bindings/runtime";
import { buildDriversExport, exportableDrivers, exportableEffectors } from "../drivers";
import { copyStyles } from "../../../render/copies";
import { resolveProps } from "../../../render/resolve";
import { getLayerGeometry } from "../../../document/properties";

const layer = (id: string) => createLayer({ id, archetype: "rectangle", properties: { "frame.width": 100, "frame.height": 60, positioning: "absolute" } }) as Layer;
const LAYERS = ["a", "b", "c", "d"];
const make = (text: string, n: number, extra: Partial<Binding> = {}): Binding => ({ ...resolveLayerRefs(parseBinding(text), (name) => (LAYERS.includes(name) ? name : undefined)), id: `b${n}`, ownerLayerId: "a", enabled: true, ...extra });

/** Twenty-two drivers: every signal the export serves, every operator it carries, every property it can drive. */
const TEXTS = [
  "pointer.x |> remap(0, 1000, 0, 300)\n-> a.transform.x",
  "pointer.y |> remap(0, 600, -50, 50) |> smooth(0.2)\n-> a.transform.y",
  "pointer.uv(page) |> component(x) |> remap(0, 1, -30, 30) |> spring(200, 20)\n-> b.transform.rotate",
  "pointer.ndc(page) |> component(y) |> deadzone(0.2) |> remap(-1, 1, -10, 10)\n-> b.transform.x",
  "pointer.speed |> remap(0, 1500, 1, 1.8)\n-> c.transform.scale",
  "pointer.speed |> remap(0, 1500, 1, 0.2) |> clamp(0.2, 1)\n-> c.appearance.opacity",
  "scroll.progress |> remap(0, 1, 0, 90)\n-> d.transform.rotate",
  "scroll.y |> mul(0.1) |> quantize(5)\n-> d.transform.y",
  "scroll.velocity |> abs |> remap(0, 3000, 0, 40) |> smooth(0.1)\n-> a.transform.rotate",
  "time |> mul(30)\n-> b.transform.rotate",
  "time |> mul(2) |> remap(0, 6, 0, 1)\n-> c.appearance.opacity",
  "pointer.dx |> mul(2) |> clamp(-20, 20)\n-> d.transform.x",
  "pointer.uv(page) |> length |> falloff(smoothstep, 1) |> remap(0, 1, 1, 2)\n-> a.transform.scale",
  "pointer.px(page) |> component(x) |> add(-500) |> falloff(gaussian, 400) |> remap(0, 1, 0, 80)\n-> b.transform.y",
  "scroll.progress |> remap(0, 1, 1, 3) |> min(2.5)\n-> b.transform.scale",
  "pointer.angle |> remap(-180, 180, -45, 45) |> smooth(0.05)\n-> c.transform.rotate",
  "scroll.direction |> mul(12)\n-> d.transform.x blend add",
  "pointer.y |> spring(120, 14) |> remap(0, 600, 0, 1)\n-> d.appearance.opacity",
  "pointer.speed |> max(100) |> remap(100, 2000, 0, 25) |> spring(300, 30)\n-> a.transform.y",
  "scroll.progress |> remap(0, 1, 0, 200) |> quantize(10)\n-> c.transform.x",
  "view(b).progress |> remap(0, 1, 0, 180)\n-> a.transform.rotate",
  "view(c).visible |> smooth(0.1) |> remap(0, 1, 1, 0.3)\n-> d.appearance.opacity",
];
const bindings = TEXTS.map((t, i) => make(t, i));

/** A fixed, wandering input: the same for the core bus and the export's bus. */
const source = (t: number): InputSource => ({
  pointer: () => ({ x: 500 + 450 * Math.sin(t * 1.7), y: 300 + 250 * Math.cos(t * 1.1), down: t > 1, coarse: false, pressure: 0.5, type: "mouse" }),
  pageSize: () => ({ width: 1000, height: 600 }),
  scroll: () => ({ y: 1200 * (0.5 - 0.5 * Math.cos(t * 0.9)), max: 1200, viewport: 700 }),
  layerBox: (id) => (id === "b" ? { top: 500, height: 300 } : id === "c" ? { top: 1100, height: 400 } : null),
});

const doc = { ...createDocumentFromLayers(LAYERS.map(layer)), bindings: Object.fromEntries(bindings.map((b) => [b.id, BindingSchema.parse(b)])) };

function exportContext() {
  const out = buildDriversExport(doc);
  assert.ok(out.source, "a script is written");
  const ctx = vm.createContext({ Math, Array, JSON, Object }); // no window: the page glue stays out of it
  vm.runInContext(out.source!, ctx);
  return { ctx: ctx as unknown as { createEffectors: (c: unknown) => { step: (live: unknown) => { layer: string; i: number; transform: string; opacity: number; filter: string }[] }; EFFECTORS: unknown[]; createDrivers: (c: unknown) => { step: (f: unknown) => { layer: string; prop: string; add: number; mul: number }[] }; busFrame: (s: unknown, st: unknown, t: number, dt: number) => { read: (s: unknown) => unknown }; newBus: () => unknown; CONFIG: unknown[] }, out };
}

const host: BindingHost = { layersOf: (s) => (s.kind === "layer" ? [s.ref] : []), base: () => undefined, env: { pointerCoarse: false, reducedMotion: false, breakpoint: "", states: new Set() } };

describe("the exported drivers script runs like the editor (D4)", () => {
  it("carries all twenty-two drivers", () => {
    const { drivers, warnings } = exportableDrivers(doc);
    assert.equal(drivers.length, 22);
    assert.deepEqual(warnings, []);
  });

  it("twenty-two drivers over a wandering pointer and a scroll: every frame of 6 seconds at 60 fps matches the editor's evaluator", () => {
    const { ctx } = exportContext();
    const core = createBindingRuntime(bindings, host);
    const exp = ctx.createDrivers(ctx.CONFIG);
    const coreBus = newBusState();
    const expBus = ctx.newBus();
    let worst = 0;
    for (let i = 0; i <= 360; i++) {
      const t = i / 60;
      const dt = 1 / 60;
      const src = source(t);
      const c = core.step(coreBusFrame(src, coreBus, t, dt));
      const e = exp.step(ctx.busFrame(src, expBus, t, dt));
      // the export's per-layer, per-property factors: the editor's value is (base + adds) x multiplies, with the registry default as base
      for (const r of e) {
        const want = c.get(r.layer)?.get(r.prop);
        assert.ok(want !== undefined, `frame ${i}: the core wrote ${r.layer} ${r.prop}`);
        const base = r.prop === "transform.scale" || r.prop === "appearance.opacity" ? 1 : 0;
        const got = (base + r.add) * r.mul;
        const wantClamped = r.prop === "appearance.opacity" ? Math.min(1, Math.max(0, got)) : got;
        const diff = Math.abs(wantClamped - want);
        worst = Math.max(worst, diff);
        assert.ok(diff < 1e-9, `frame ${i}: ${r.layer} ${r.prop}: export ${wantClamped} vs editor ${want}`);
      }
      assert.equal(e.length, new Set([...c].flatMap(([l, m]) => [...m.keys()].map((p) => `${l}|${p}`))).size, `frame ${i}: the same properties are written`);
    }
    assert.ok(worst < 1e-9);
  });

  it("the bus matches the editor's bus on every signal the export serves", () => {
    const { ctx } = exportContext();
    const coreBus = newBusState();
    const expBus = ctx.newBus();
    const signals = [
      { kind: "pointer", channel: "x" }, { kind: "pointer", channel: "y" }, { kind: "pointer", channel: "dx" }, { kind: "pointer", channel: "dy" },
      { kind: "pointer", channel: "speed" }, { kind: "pointer", channel: "angle" }, { kind: "pointer", channel: "down" },
      { kind: "pointerIn", channel: "uv", space: "page" }, { kind: "pointerIn", channel: "ndc", space: "page" }, { kind: "pointerIn", channel: "px", space: "page" },
      { kind: "scroll", channel: "y" }, { kind: "scroll", channel: "progress" }, { kind: "scroll", channel: "velocity" }, { kind: "scroll", channel: "direction" },
      { kind: "view", layer: "b", channel: "progress" }, { kind: "view", layer: "b", channel: "visible" }, { kind: "view", layer: "c", channel: "visible" }, { kind: "view", layer: "ghost", channel: "progress" },
    ]; // (time and frameDt are answered by the evaluator itself, not the bus; the drivers on `time` are in the twenty above)
    for (let i = 0; i <= 120; i++) {
      const t = i / 60;
      const a = coreBusFrame(source(t), coreBus, t, 1 / 60);
      const b = ctx.busFrame(source(t), expBus, t, 1 / 60);
      for (const s of signals) {
        const x = a.read(s as never);
        const y = b.read(s);
        const norm = (v: unknown) => (Array.isArray(v) ? Array.from(v as number[]) : typeof v === "boolean" ? (v ? 1 : 0) : v); // (arrays from the VM are of another realm)
        assert.deepEqual(norm(y), norm(x), `frame ${i}: ${JSON.stringify(s)}`);
      }
    }
  });

  it("a driver the export cannot carry is left out, with a warning that says why", () => {
    const odd = { ...doc, bindings: { ...doc.bindings, z1: BindingSchema.parse(make("pointer.x |> toggle\n-> a.transform.x", 91)), z2: BindingSchema.parse(make("pointer.x\n-> a.transform.x blend replace", 92)), z3: BindingSchema.parse(make("device.tiltX\n-> a.transform.rotate", 93)), z4: BindingSchema.parse(make("pointer.x\n-> a.cssvar.glow", 94)) } };
    const { drivers, warnings } = exportableDrivers(odd);
    assert.equal(drivers.length, 22);
    assert.equal(warnings.length, 4);
    assert.ok(warnings.some((w) => /toggle/.test(w)));
    assert.ok(warnings.some((w) => /replace/.test(w)));
    assert.ok(warnings.some((w) => /device/.test(w)));
    assert.ok(warnings.some((w) => /cssvar/.test(w)));
  });

  it("only the operators the project uses are written out, and nothing is imported", () => {
    const one = { ...doc, bindings: { b0: BindingSchema.parse(make("pointer.x |> remap(0, 1000, 0, 300)\n-> a.transform.x", 0)) } };
    const out = buildDriversExport(one).source!;
    assert.match(out, /remap: function/);
    assert.doesNotMatch(out, /spring: function/);
    assert.doesNotMatch(out, /\bimport\b|\brequire\(/);
    assert.match(out, /^\/\*\n \* Drivers, exported from LazyLayout\./);
  });

  it("no drivers means no script at all", () => {
    assert.equal(buildDriversExport({ ...doc, bindings: {} }).source, null);
  });

  describe("live effectors", () => {
    const effectorLayer = (id: string, props: Record<string, unknown>) =>
      createLayer({ id, archetype: "ellipse", properties: { positioning: "absolute", "frame.x": 120, "frame.y": 80, "frame.width": 24, "frame.height": 24, ...props } }) as Layer;
    const CASES: Record<string, unknown>[] = [
      { "clone.mode": "grid", "clone.cols": 8, "clone.rows": 5, "clone.gapX": 16, "clone.gapY": 12, "effector.mode": "pointer", "effector.scale": 3, "effector.radius": 180, "effector.falloff": "smoothstep" },
      { "clone.mode": "grid", "clone.cols": 6, "clone.rows": 6, "clone.gapX": 10, "clone.gapY": 10, "effector.mode": "pointer", "effector.scale": 2, "effector.fade": 0.4, "effector.offsetX": 8, "effector.offsetY": -6, "effector.radius": 120, "effector.falloff": "linear", "effector.hue": 70 },
      { "clone.mode": "radial", "clone.count": 12, "clone.radius": 90, "clone.faceOut": true, "effector.mode": "pointer", "effector.scale": 1.8, "effector.radius": 200, "effector.falloff": "gaussian", "effector.hue": -40 },
      { "repeat.count": 15, "repeat.x": 30, "repeat.rotate": 4, "repeat.scale": 0.97, "repeat.opacity": 0.95, "effector.mode": "scroll", "effector.scale": 3, "effector.spread": 2.5, "effector.falloff": "linear", "effector.hue": 90 },
      { "repeat.count": 20, "repeat.y": 18, "effector.mode": "scroll", "effector.scale": 2.2, "effector.fade": 0.3, "effector.spread": 4, "effector.falloff": "inverse-square", "effector.offsetX": 12 },
    ];
    CASES.forEach((props, n) => {
      it(`case ${n + 1} (${props["effector.mode"]}, ${props["effector.falloff"]}): every copy's CSS is the same string as the editor's, on 150 inputs`, () => {
        const l = effectorLayer("e", props);
        const d = createDocumentFromLayers([l]);
        const { ctx } = (() => {
          const out = buildDriversExport(d);
          assert.ok(out.source);
          const c = vm.createContext({ Math, Array, JSON, Object });
          vm.runInContext(out.source!, c);
          return { ctx: c as unknown as { createEffectors: (c: unknown) => { step: (live: unknown) => { layer: string; i: number; transform: string; opacity: number; filter: string }[] }; EFFECTORS: unknown[] } };
        })();
        assert.equal(exportableEffectors(d).length, 1);
        const fx = ctx.createEffectors(ctx.EFFECTORS);
        const get = resolveProps(l).get;
        const frame = getLayerGeometry(l).frame;
        for (let i = 0; i < 150; i++) {
          const live = props["effector.mode"] === "pointer" ? { pointer: { x: 200 + 180 * Math.sin(i * 0.31), y: 120 + 100 * Math.cos(i * 0.23) }, progress: null } : { pointer: null, progress: i / 149 };
          const want = copyStyles(get, frame, { width: 0, height: 0 }, live);
          const got = fx.step(live);
          assert.equal(got.length, want.length, `input ${i}: the same number of copies`);
          want.forEach((w, k) => {
            assert.equal(got[k].i, w.index);
            assert.equal(got[k].transform, w.transform, `input ${i}, copy ${w.index}: transform`);
            assert.equal(got[k].opacity, w.opacity, `input ${i}, copy ${w.index}: opacity`);
            assert.equal(got[k].filter, w.filter ?? "", `input ${i}, copy ${w.index}: filter`);
          });
        }
      });
    });

    it("an effector that is not live (a ramp, noise) is not in the script: it is already drawn into the page", () => {
      const l = effectorLayer("e", { "repeat.count": 5, "repeat.x": 40, "effector.mode": "index", "effector.scale": 2 });
      assert.equal(exportableEffectors(createDocumentFromLayers([l])).length, 0);
      assert.equal(buildDriversExport(createDocumentFromLayers([l])).source, null);
    });
  });
});

import { buildSiteExport } from "../../site";
import { setLayerPropsForTest } from "./linkFixture";

describe("the export says what it leaves out", () => {
  it("a link or expression it cannot carry is named in the warnings, not dropped silently; one it can carry is not", async () => {
    const cannot = setLayerPropsForTest(doc, "a", { "link.1.target": "typography.fontSize", "link.1.source": "b", "link.1.sourceProperty": "transform.x", "link.1.enabled": true });
    const out = await buildSiteExport(cannot, { target: "html", styling: "css" });
    assert.ok(out.warnings.some((w) => /only position, rotation, scale and opacity/.test(w)), out.warnings.join(" | "));
    const can = setLayerPropsForTest(doc, "a", { "link.1.target": "transform.rotate", "link.1.source": "b", "link.1.sourceProperty": "transform.rotate", "link.1.enabled": true });
    const ok = await buildSiteExport(can, { target: "html", styling: "css" });
    assert.ok(!ok.warnings.some((w) => /link on|expression on/.test(w)), ok.warnings.join(" | "));
    assert.ok(ok.files.some((f) => f.path === "lazylayout-drivers.js"), "it is exported");
  });
});
