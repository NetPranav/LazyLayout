import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { documentCommands, getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { KernelAdapter } from "../../engine/stage/KernelAdapter";
import { VariantDriver } from "../../engine/stage/VariantDriver";
import type { AdapterHost } from "../../engine/stage/types";
import { registerComponentCommands } from "../componentCommands";
import { registerTransitionCommands } from "../../states/transitionCommands";
import { createComponent, insertInstance } from "../componentOps";
import { subtreeIds } from "../instances";
import { addVariantProperty, setVariant } from "../variantOps";
import { lookDifference, lookOf, triggeredValues, variantInstanceRoots, variantLook, variantTriggerOf, variantValuesOf } from "../variantMotion";

/** ROADMAP Phase 80: a toggle component whose instances animate between Off and On. */
const DT = 1 / 60;
const frame = (id: string, parentId: string, extra: Record<string, unknown> = {}, children: string[] = []): Layer =>
  createLayer({ id, archetype: "container", parentId, name: id, children, properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 60, "frame.height": 32, "layout.padding": 0, "appearance.background.color": "#cccccc", ...extra } }) as Layer;

const L = (id: string) => getDocument().layers[id];
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; code?: string; changed?: number };
const comp = () => Object.keys(getDocument().compositions)[0] ?? "main";
const part = (root: string, name: string) => subtreeIds(getDocument().layers, root).map(L).find((l) => l.name === name)!;

let offs: Array<() => void> = [];
let c = "";
let inst = "";
let knob = "";
beforeEach(() => {
  setDocument(
    createDocumentFromLayers([
      createLayer({ id: "pg", archetype: "container", parentId: null, name: "Page", children: ["toggle"], properties: { "frame.width": 2000, "frame.height": 1600 } }) as Layer,
      frame("toggle", "pg", { "frame.x": 20, "frame.y": 20 }, ["knob"]),
      frame("knob", "toggle", { "frame.x": 2, "frame.y": 2, "frame.width": 28, "frame.height": 28, "appearance.background.color": "#ffffff", "transform.x": 0 }),
    ])
  );
  useSelectionStore.getState().clearSelection();
  offs = [registerComponentCommands(), registerTransitionCommands()];
  c = createComponent(["toggle"])!;
  addVariantProperty(c, "On", ["Off", "On"]);
  const onMain = getDocument().designComponents![c].variants![1].mainId;
  const onKnob = part(onMain, "knob").id;
  documentCommands.updateProps(onMain, { "appearance.background.color": "#00aa00" });
  documentCommands.updateProps(onKnob, { "transform.x": 28, "appearance.opacity": 0.5 });
  inst = insertInstance(c, { parentId: "pg", at: { x: 400, y: 400 } })!;
  knob = part(inst, "knob").id;
});
afterEach(() => offs.forEach((off) => off()));

const makeDriver = (opts: { live?: boolean; reduced?: boolean } = {}) => {
  let pointer: { x: number; y: number; down: boolean } | null = null;
  let live = opts.live ?? false;
  const driver = new VariantDriver({
    getDocument,
    live: () => live,
    reducedMotion: () => opts.reduced ?? false,
    source: { pointer: () => (pointer ? { ...pointer, coarse: false, pressure: 0.5, type: "mouse" as const } : null), pageSize: () => ({ width: 2000, height: 1600 }), scroll: () => ({ y: 0, max: 0 }), layerRect: (id) => (id === inst ? { x: 400, y: 400, width: 60, height: 32 } : null) },
  });
  /** One frame: the knob's x as `evaluate()` gives it with the driver's input. */
  const step = () => {
    const f = driver.idle ? null : driver.update(DT);
    return { frame: f, x: evaluate(getDocument(), comp(), knob, 0, { propMix: f?.propMix })["transform.x"] as number, root: evaluate(getDocument(), comp(), inst, 0, { propMix: f?.propMix }) };
  };
  return { driver, step, point: (p: typeof pointer) => (pointer = p), setLive: (v: boolean) => (live = v) };
};

describe("Phase 80: the look of a variant", () => {
  it("variantLook says what each layer would look like in another variant, and changes nothing", () => {
    const before = getDocument();
    const look = variantLook(before, inst, { On: "On" })!;
    assert.equal(getDocument(), before, "the document is untouched");
    assert.equal(look.get(knob)!["transform.x"], 28);
    assert.equal(look.get(inst)!["appearance.background.color"], "#00aa00");
    assert.equal(L(knob).properties["transform.x"], 0);
    assert.equal(variantLook(before, inst, { On: "Nope" }), null);
    // and it is what a real switch gives
    setVariant([inst], { On: "On" });
    assert.deepEqual(look.get(knob), L(knob).properties);
  });
  it("the difference lists what moves: the knob's place and opacity, the track's colour; never where the instance sits", () => {
    const d = lookDifference(lookOf(getDocument(), inst), variantLook(getDocument(), inst, { On: "On" })!, inst);
    assert.deepEqual(d.get(knob), { from: { "transform.x": 0, "appearance.opacity": 1 }, to: { "transform.x": 28, "appearance.opacity": 0.5 } });
    assert.deepEqual(Object.keys(d.get(inst)!.to), ["appearance.background.color"]);
  });
  it("an instance keeps its own overrides in the other variant's look", () => {
    documentCommands.updateProps(knob, { "appearance.background.color": "#ff0000" });
    assert.equal(variantLook(getDocument(), inst, { On: "On" })!.get(knob)!["appearance.background.color"], "#ff0000");
  });
});

describe("Phase 80: a variant switch animates", () => {
  it("the reference: Off to On moves the knob on the instance's spring, every frame is evaluate(), and it ends on the document", () => {
    const { driver, step } = makeDriver();
    assert.equal(step().frame, null, "nothing to do before a switch");
    assert.equal(driver.idle, true);
    setVariant([inst], { On: "On" });
    const xs: number[] = [];
    let colourMid = "";
    for (let i = 0; i < 120; i++) {
      const s = step();
      xs.push(s.x);
      if (i === 5) colourMid = String(s.root["appearance.background.color"]);
    }
    assert.ok(xs[0] < 3, `the first frame is still near Off (${xs[0]})`);
    assert.ok(xs[5] > 3 && xs[5] < 27, `on the way after 6 frames (${xs[5]})`);
    assert.ok(Math.max(...xs) > 28, "the default spring overshoots a little");
    assert.equal(xs[xs.length - 1], 28);
    assert.notEqual(colourMid, "#cccccc");
    assert.notEqual(colourMid, "#00aa00", "the colour is mixed on the way, not switched");
    assert.equal(driver.idle, true, "at rest it costs nothing");
    let biggest = 0;
    for (let i = 1; i < xs.length; i++) biggest = Math.max(biggest, Math.abs(xs[i] - xs[i - 1]));
    assert.ok(biggest < 8, `no frame jumps (${biggest}px of 28)`);
  });
  it("a switch interrupted and turned back keeps its speed: no snap in ten quick switches", () => {
    run("layer.setTransition", { ids: [inst], duration: 0.6, bounce: 0 });
    const { step } = makeDriver();
    step();
    const xs: number[] = [];
    for (let i = 0; i < 10; i++) {
      setVariant([inst], { On: i % 2 === 0 ? "On" : "Off" });
      for (let f = 0; f < 5; f++) xs.push(step().x);
    }
    for (let f = 0; f < 200; f++) xs.push(step().x);
    let biggest = 0;
    let jerk = 0;
    for (let i = 1; i < xs.length; i++) {
      biggest = Math.max(biggest, Math.abs(xs[i] - xs[i - 1]));
      if (i > 1) jerk = Math.max(jerk, Math.abs(xs[i] - 2 * xs[i - 1] + xs[i - 2]));
    }
    assert.ok(biggest < 3, `no frame jumps (${biggest})`);
    assert.ok(jerk < 0.6, `the speed never changes at once (${jerk})`);
    assert.ok(Math.max(...xs.slice(0, 50)) < 27, "it was always turned back before it arrived");
    assert.equal(xs[xs.length - 1], 0, "ten switches end on Off, at rest");
  });
  it("the adapter draws it: the knob's written transform is evaluate() at every frame, and what React drew comes back", () => {
    const values = new Map<string, string>();
    const element = { style: { setProperty: (n: string, v: string) => void values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" } };
    const adapter = new KernelAdapter();
    adapter.mount({ node: (id: string) => (id === knob ? element : undefined), getDocument, compositionId: comp, fps: () => 60, duration: () => 1 } as unknown as AdapterHost);
    const { driver } = makeDriver();
    assert.equal(driver.idle, true);
    setVariant([inst], { On: "On" });
    let seen = 0;
    for (let i = 0; i < 90 && !driver.idle; i++) {
      const f = driver.update(DT);
      adapter.setPropMix(f);
      adapter.seek(0);
      if (!f) break;
      const x = evaluate(getDocument(), comp(), knob, 0, { propMix: f.propMix })["transform.x"] as number;
      const drawn = Number(/translate3d\(([-\d.e]+)px/.exec(values.get("transform") ?? "")?.[1]);
      assert.ok(Math.abs(drawn - x) < 1e-3, `frame ${i}: ${values.get("transform")} shows x ${x}`);
      seen++;
    }
    assert.ok(seen > 10, "many frames on the way");
    adapter.setPropMix(null);
    adapter.seek(0);
    assert.equal(values.get("transform"), undefined, "done: the element is React's again");
  });
  it("switched to and fro while it moves, the element ends on what React drew last, not on what it held at the first write", () => {
    // the knob's `left` is React's: 2px in Off, 30px in On. frame.x differs between the variants here.
    const onMain = getDocument().designComponents![c].variants![1].mainId;
    documentCommands.updateProps(part(onMain, "knob").id, { "frame.x": 30 });
    const values = new Map<string, string>([["left", "2px"]]);
    const element = { style: { setProperty: (n: string, v: string) => void values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" } };
    const adapter = new KernelAdapter();
    adapter.mount({ node: (id: string) => (id === knob ? element : undefined), getDocument, compositionId: comp, fps: () => 60, duration: () => 1 } as unknown as AdapterHost);
    const { driver } = makeDriver();
    assert.equal(driver.idle, true);
    const frames = (n: number) => {
      for (let i = 0; i < n && !driver.idle; i++) {
        adapter.setPropMix(driver.update(DT));
        adapter.seek(0);
      }
    };
    /** A switch as the editor makes it: the document changes, the engine hears of it, then React draws the knob where the variant puts it. */
    const flip = (to: "On" | "Off") => {
      setVariant([inst], { On: to });
      adapter.invalidate();
      values.set("left", to === "On" ? "30px" : "2px");
    };
    flip("On");
    frames(5);
    assert.notEqual(values.get("left"), "30px", "on the way");
    flip("Off");
    frames(400);
    assert.equal(driver.idle, true);
    adapter.setPropMix(null);
    adapter.seek(0);
    assert.equal(values.get("left"), "2px", "at rest on Off: React's 2px, not the 30px it held at the first write");
  });
  it("reduced motion switches at once; a switch that changes nothing animates nothing", () => {
    const { step } = makeDriver({ reduced: true });
    step();
    setVariant([inst], { On: "On" });
    assert.equal(step().x, 28);
  });
});

describe("Phase 80: an instance's own interaction", () => {
  it("component.setVariantTrigger writes it on the instance, in one undo step, and refuses what the component doesn't have", () => {
    assert.equal(variantTriggerOf(getDocument(), inst), null);
    assert.equal(run("component.setVariantTrigger", { id: knob, on: "click", value: "On" }).ok, true, "any layer of the instance will do");
    assert.deepEqual(variantTriggerOf(getDocument(), inst), { on: "click", property: "On", value: "On" });
    historyCommands.undo();
    assert.equal(variantTriggerOf(getDocument(), inst), null, "one undo step takes all of it back");
    historyCommands.redo();
    assert.equal(run("component.setVariantTrigger", { id: inst, value: "Purple" }).code, "NO_VALUE");
    assert.equal(run("component.setVariantTrigger", { id: inst, property: "Size" }).code, "NO_PROPERTY");
    assert.equal(run("component.setVariantTrigger", { id: "pg", on: "hover" }).code, "NOT_A_VARIANT_INSTANCE");
    run("component.setVariantTrigger", { id: inst, on: "none" });
    assert.equal(variantTriggerOf(getDocument(), inst), null);
    assert.equal(L(inst).properties["variantTrigger.value"], undefined);
  });
  it("a click shows the other variant without changing the document, and the next click goes back", () => {
    run("component.setVariantTrigger", { id: inst, on: "click" });
    const doc = getDocument();
    const { driver, step, point } = makeDriver({ live: true });
    point({ x: 10, y: 10, down: false });
    assert.equal(step().x, 0);
    point({ x: 410, y: 410, down: true }); // pressed on the instance
    step();
    point({ x: 410, y: 410, down: false });
    let x = 0;
    for (let i = 0; i < 120; i++) x = step().x;
    assert.equal(x, 28, "it went to On and stays there");
    assert.deepEqual(driver.showing(inst), { On: "On" });
    assert.equal(getDocument(), doc, "the document still says Off");
    assert.equal(variantValuesOf(getDocument(), inst).On, "Off");
    point({ x: 410, y: 410, down: true });
    step();
    point({ x: 410, y: 410, down: false });
    for (let i = 0; i < 120; i++) x = step().x;
    assert.equal(x, 0);
    assert.equal(driver.showing(inst), null);
    // a press somewhere else does nothing
    point({ x: 10, y: 10, down: true });
    assert.equal(step().x, 0);
  });
  it("hover shows it while the pointer is there; leaving live interactions puts every instance back", () => {
    run("component.setVariantTrigger", { id: inst, on: "hover", value: "On" });
    const { step, point, setLive } = makeDriver({ live: true });
    point({ x: 410, y: 410, down: false });
    let x = 0;
    for (let i = 0; i < 120; i++) x = step().x;
    assert.equal(x, 28);
    point({ x: 10, y: 10, down: false });
    const first = step().x;
    assert.ok(first > 20, "leaving starts from where it is");
    for (let i = 0; i < 120; i++) x = step().x;
    assert.equal(x, 0);
    point({ x: 410, y: 410, down: false });
    for (let i = 0; i < 120; i++) x = step().x;
    setLive(false);
    for (let i = 0; i < 120; i++) x = step().x;
    assert.equal(x, 0, "back to the document's variant");
  });
  it("the next value cycles; a named value toggles with the instance's own", () => {
    const doc = getDocument();
    assert.deepEqual(triggeredValues(doc, inst, { on: "click", property: "On", value: "" }, { On: "Off" }, { On: "Off" }), { On: "On" });
    assert.deepEqual(triggeredValues(doc, inst, { on: "click", property: "On", value: "" }, { On: "On" }, { On: "Off" }), { On: "Off" });
    assert.deepEqual(triggeredValues(doc, inst, { on: "click", property: "On", value: "On" }, { On: "On" }, { On: "Off" }), { On: "Off" });
    assert.deepEqual(variantInstanceRoots(doc), [inst]);
  });
});

describe("Phase 80: an instance's motion is its own", () => {
  it("its transition and trigger survive edits to the main component, and another instance keeps the main's", () => {
    const other = insertInstance(c, { parentId: "pg", at: { x: 600, y: 400 } })!;
    run("layer.setTransition", { ids: [inst], type: "tween", duration: 1.2 });
    run("component.setVariantTrigger", { id: inst, on: "click" });
    // the main gets a transition of its own and a new colour
    const main = getDocument().designComponents![c].variants![0].mainId;
    run("layer.setTransition", { ids: [main], duration: 0.2 });
    documentCommands.updateProps(main, { "appearance.background.color": "#123456" });
    assert.equal(L(inst).properties["appearance.background.color"], "#123456", "the main's edit reached the instance");
    assert.equal(L(inst).properties["transition.type"], "tween");
    assert.equal(L(inst).properties["transition.duration"], 1.2);
    assert.equal(L(inst).properties["variantTrigger.on"], "click");
    assert.equal(L(other).properties["transition.duration"], 0.2, "an instance without its own takes the main's");
    assert.equal(L(other).properties["variantTrigger.on"], undefined);
    // and they survive a change of variant
    setVariant([inst], { On: "On" });
    assert.equal(L(inst).properties["transition.duration"], 1.2);
    assert.equal(L(inst).properties["variantTrigger.on"], "click");
  });
});
