import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../../store/documentState";
import { documentCommands, historyCommands } from "../../../store/useDocumentStore";
import { tryRunCommand } from "../../../commands";
import { registerTransitionCommands } from "../../../states/transitionCommands";
import { useStateEditStore } from "../../../states/stateEdit";
import { Mover, kernelMover, type MoverFactory, type TransitionSpec } from "../../../states/transitions";
import { evaluate } from "../../../kernel/evaluate";
import { StateDriver } from "../../stage/StateDriver";
import { LayoutDriver, type LayoutElement } from "../../stage/LayoutDriver";
import { perceptualToPhysical } from "../../../kernel/springs";
import { MotionMover, loadMotion, motionEngine, setMotionEngine, stageMover, type MotionEngine } from "../MotionAdapter";
import { motionKey, motionPropsOf, motionTransition } from "../motionConfig";
import { layoutJump, layoutMotionOf, presencePose } from "../layoutMotion";

/** ROADMAP Phase 87: the Motion engine adapter. */
const DT = 1 / 60;
const SPRING: TransitionSpec = { type: "spring", duration: 0.35, bounce: 0.15, curve: "power2.out" };
const SLOW: TransitionSpec = { type: "spring", duration: 0.6, bounce: 0, curve: "power2.out" };
const TWEEN: TransitionSpec = { type: "tween", duration: 0.3, bounce: 0, curve: "power2.out" };
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; changed?: number };

let motion: MotionEngine;
let viaMotion: MoverFactory;
let off: () => void;
beforeEach(async () => {
  motion = await loadMotion();
  viaMotion = (spec, value) => new MotionMover(motion, spec, value);
  useStateEditStore.getState().edit(null, null);
  off = registerTransitionCommands();
});
afterEach(() => off());
const comp = () => Object.keys(getDocument().compositions)[0] ?? "main";

/** The biggest change of step a spring can make in one frame by itself: its pull at full stretch, times the frame squared. More than this is a change of speed at once (a snap). */
const pull = (duration: number, bounce: number, stretch: number) => perceptualToPhysical(bounce, duration).stiffness * stretch * DT * DT * 1.25;

/** Steps a series and says how big the biggest step and the biggest change of step were. */
function smoothness(xs: number[]) {
  let step = 0;
  let jerk = 0;
  for (let i = 1; i < xs.length; i++) {
    step = Math.max(step, Math.abs(xs[i] - xs[i - 1]));
    if (i > 1) jerk = Math.max(jerk, Math.abs(xs[i] - 2 * xs[i - 1] + xs[i - 2]));
  }
  return { step, jerk };
}

describe("Phase 87: Motion is loaded lazily and does the kernel's job", () => {
  it("until it has loaded the stage uses the kernel's spring; afterwards Motion's", async () => {
    setMotionEngine(null);
    assert.equal(motionEngine(), null);
    assert.ok(stageMover(kernelMover)(SPRING) instanceof Mover, "not loaded: the kernel's");
    await loadMotion();
    assert.ok(motionEngine(), "loaded");
    assert.ok(stageMover(kernelMover)(SPRING) instanceof MotionMover);
    assert.equal(await loadMotion(), motionEngine(), "loading twice gives the same engine");
  });
  it("Motion's spring and tween draw the same curve as the kernel's, frame for frame", () => {
    for (const spec of [SPRING, SLOW, TWEEN, { ...SPRING, bounce: 0.5, duration: 0.8 }]) {
      const a = new Mover(spec);
      const b = new MotionMover(motion, spec);
      a.to(1);
      b.to(1);
      for (let i = 0; i < 120; i++) {
        a.step(DT);
        b.step(DT);
        assert.ok(Math.abs(a.value - b.value) < 2e-3, `${spec.type} ${spec.duration}/${spec.bounce} frame ${i}: ${a.value} vs ${b.value}`);
      }
      for (let i = 0; i < 480; i++) b.step(DT); // a bouncy one is still settling after two seconds
      assert.equal(b.value, 1);
      assert.equal(b.resting, true, "Motion's comes to rest exactly");
    }
  });
  it("an interrupted Motion spring keeps its speed, and a shift moves it without touching the speed", () => {
    const m = new MotionMover(motion, SPRING);
    m.to(1);
    for (let i = 0; i < 6; i++) m.step(DT);
    const before = { value: m.value, velocity: m.velocity };
    assert.ok(before.velocity > 1);
    m.to(0);
    assert.equal(m.value, before.value);
    const next = m.step(DT);
    assert.ok(next > before.value, "it carries on upwards for a moment: the speed was kept");
    const again = { value: m.value, velocity: m.velocity };
    m.shift(10);
    assert.equal(m.value, again.value + 10);
    assert.equal(m.velocity, again.velocity, "the shift moves it and leaves its speed alone");
    const dv = Math.abs((m.step(DT / 100) - (again.value + 10)) / (DT / 100) - again.velocity);
    assert.ok(dv < Math.abs(again.velocity) * 0.2 + 2, `and it carries on at that speed (${dv} off ${again.velocity})`);
    for (let i = 0; i < 300; i++) m.step(DT);
    assert.equal(m.value, 0);
  });
});

describe("Phase 87: the spring-heavy references keep velocity on interruption, on Motion", () => {
  it("the toggle: hovered in and out 10 times, far quicker than one move", () => {
    const b = new DocBuilder();
    const btn = b.layer("container", "Toggle", null, { "transform.x": 0 });
    setDocument(b.build());
    documentCommands.addState(btn, "hover", { "transform.x": 100 }, "Add state");
    run("layer.setTransition", { ids: [btn], duration: 0.6, bounce: 0 });
    let p: { x: number; y: number; down: boolean } | null = null;
    const driver = new StateDriver({
      getDocument, editing: () => null, live: () => true, reducedMotion: () => false, mover: () => viaMotion,
      source: { pointer: () => (p ? { ...p, coarse: false, pressure: 0.5, type: "mouse" as const } : null), pageSize: () => ({ width: 800, height: 600 }), scroll: () => ({ y: 0, max: 0 }), layerRect: (id) => (id === btn ? { x: 0, y: 0, width: 100, height: 40 } : null) },
    });
    const xs: number[] = [];
    const frame = () => {
      const f = driver.update(DT);
      xs.push((evaluate(getDocument(), comp(), btn, 0, { stateMix: f?.stateMix })["transform.x"] as number) ?? 0);
    };
    for (let i = 0; i < 10; i++) {
      p = i % 2 === 0 ? { x: 50, y: 20, down: false } : { x: 500, y: 300, down: false };
      for (let f = 0; f < 5; f++) frame();
    }
    for (let f = 0; f < 300; f++) frame();
    const s = smoothness(xs);
    assert.ok(s.step < 10, `no snap (${s.step} of 100)`);
    assert.ok(s.jerk < pull(0.6, 0, 100), `the speed never changes at once (${s.jerk})`);
    assert.ok(Math.max(...xs) < 95, "always turned back before arriving");
    assert.equal(xs[xs.length - 1], 0);
  });
  it("the dock: the pointer sweeps over five items and back; every item's size is smooth", () => {
    const b = new DocBuilder();
    const items = Array.from({ length: 5 }, (_, i) => b.layer("container", `Item ${i}`, null, { "transform.scale": 1 }));
    setDocument(b.build());
    for (const id of items) {
      documentCommands.addState(id, "hover", { "transform.scale": 1.6 }, "Add state");
      run("layer.setTransition", { ids: [id], duration: 0.4, bounce: 0.2 });
    }
    let x = -100;
    const driver = new StateDriver({
      getDocument, editing: () => null, live: () => true, reducedMotion: () => false, mover: () => viaMotion,
      source: { pointer: () => ({ x, y: 20, down: false, coarse: false, pressure: 0.5, type: "mouse" as const }), pageSize: () => ({ width: 800, height: 600 }), scroll: () => ({ y: 0, max: 0 }), layerRect: (id) => ({ x: items.indexOf(id) * 60, y: 0, width: 60, height: 40 }) },
    });
    const series = items.map(() => [] as number[]);
    const frame = () => {
      const f = driver.update(DT);
      items.forEach((id, i) => series[i].push((evaluate(getDocument(), comp(), id, 0, { stateMix: f?.stateMix })["transform.scale"] as number) ?? 1));
    };
    for (let sweep = 0; sweep < 3; sweep++) {
      for (let i = 0; i <= 40; i++) {
        x = sweep % 2 === 0 ? i * 7.5 : 300 - i * 7.5; // 300 px in two thirds of a second: each item is left long before it has grown
        frame();
      }
    }
    x = -100;
    for (let f = 0; f < 300; f++) frame();
    for (const xs of series) {
      const s = smoothness(xs);
      assert.ok(s.step < 0.08, `no snap (${s.step} of 0.6)`);
      assert.ok(s.jerk < pull(0.4, 0.2, 0.6), `the speed never changes at once (${s.jerk})`);
      assert.ok(Math.max(...xs) > 1.05 && Math.max(...xs) < 1.6, "each grew, and was left before it was full size");
      assert.equal(xs[xs.length - 1], 1);
    }
  });
  it("stacked cards: reordered, and reordered again before they arrive", () => {
    const b = new DocBuilder();
    const stack = b.layer("container", "Stack", null, {});
    const cards = [0, 1, 2].map((i) => b.layer("container", `Card ${i}`, stack, { "layoutMotion.on": true }));
    setDocument(b.build());
    for (const id of cards) run("layer.setTransition", { ids: [id], duration: 0.6, bounce: 0 });
    // the layout: each card 100 px below the one before, in the stack's order
    let order = [0, 1, 2];
    const els = cards.map((_, i) => fake(() => ({ left: 0, top: order.indexOf(i) * 100 })));
    const driver = new LayoutDriver({ getDocument, node: (id) => els[cards.indexOf(id)], live: () => true, reducedMotion: () => false, mover: () => viaMotion });
    const drawn = cards.map(() => [] as number[]);
    const frame = () => {
      driver.update(DT);
      cards.forEach((id, i) => drawn[i].push(els[i].offsetTop + translateY(els[i])));
    };
    for (let f = 0; f < 5; f++) frame();
    order = [2, 0, 1]; // the last card comes to the top
    for (let f = 0; f < 6; f++) frame();
    assert.ok(drawn[2][drawn[2].length - 1] > 20 && drawn[2][drawn[2].length - 1] < 190, `card 2 is on its way up (${drawn[2][drawn[2].length - 1]})`);
    order = [0, 1, 2]; // and back, before it arrived
    for (let f = 0; f < 6; f++) frame();
    order = [1, 2, 0];
    for (let f = 0; f < 400; f++) frame();
    drawn.forEach((ys, i) => {
      const s = smoothness(ys);
      assert.ok(s.step < 12, `card ${i}: no snap (${s.step} of 100-200)`);
      assert.ok(s.jerk < pull(0.6, 0, 200), `card ${i}: the speed never changes at once (${s.jerk} of ${pull(0.6, 0, 200)})`);
      assert.equal(ys[ys.length - 1], order.indexOf(i) * 100, "at rest where the layout puts it");
      assert.equal(els[i].style.getPropertyValue("translate"), "", "and the element is as React drew it");
    });
    assert.equal(driver.moving, 0);
  });
});

/** A stand-in element whose layout position comes from `at`. */
function fake(at: () => { left: number; top: number }, initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const appended: unknown[] = [];
  const style = { setProperty: (n: string, v: string) => void values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" };
  const el = {
    get offsetLeft() { return at().left; },
    get offsetTop() { return at().top; },
    offsetWidth: 80,
    offsetHeight: 40,
    style,
    values,
    appended,
    parentElement: { appendChild: (n: unknown) => void appended.push(n) },
    cloneNode: () => {
      const g = fake(at);
      return Object.assign(g, { removed: false, attrs: {} as Record<string, string>, remove() { (g as unknown as { removed: boolean }).removed = true; }, setAttribute(n: string, v: string) { (g as unknown as { attrs: Record<string, string> }).attrs[n] = v; } });
    },
  };
  return el as typeof el & LayoutElement;
}
const translateY = (el: LayoutElement) => Number(/^\S+ (\S+)px$/.exec(el.style.getPropertyValue("translate"))?.[1] ?? 0);
const translateX = (el: LayoutElement) => Number(/^(\S+)px/.exec(el.style.getPropertyValue("translate"))?.[1] ?? 0);

describe("Phase 87: layout motion and presence", () => {
  it("a jump is a move the frame before doesn't explain; a layer carried along is not jumping", () => {
    assert.equal(layoutJump(0, 0, 100), 100);
    assert.equal(layoutJump(0, 4, 8), 0, "the same speed as the frame before");
    assert.equal(layoutJump(0, 4, 9.5), 0, "speeding up a little");
    assert.equal(layoutJump(0, 4, 108), 100);
    assert.deepEqual(layoutMotionOf({}), { on: false, enter: "none", exit: "none" });
    assert.deepEqual(presencePose("rise", 0), { opacity: 0, scale: 1, y: 16 });
    assert.deepEqual(presencePose("scale", 1), { opacity: 1, scale: 1, y: 0 });
  });
  it("layer.setLayoutMotion writes the settings in one undo step", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Card", null, {});
    setDocument(b.build());
    assert.equal(run("layer.setLayoutMotion", { ids: [id], on: true, enter: "rise", exit: "fade" }).changed, 1);
    assert.deepEqual(layoutMotionOf(getDocument().layers[id].properties), { on: true, enter: "rise", exit: "fade" });
    historyCommands.undo();
    assert.deepEqual(layoutMotionOf(getDocument().layers[id].properties), { on: false, enter: "none", exit: "none" });
    historyCommands.redo();
    run("layer.setLayoutMotion", { ids: [id], on: false, enter: "none" });
    assert.equal(getDocument().layers[id].properties["layoutMotion.on"], undefined);
    assert.equal(getDocument().layers[id].properties["presence.enter"], undefined);
  });
  it("a layout jump is drawn from where the layer was; a layer carried along by an animation is left alone; without the setting nothing is written", () => {
    const b = new DocBuilder();
    const a = b.layer("container", "A", null, { "layoutMotion.on": true });
    const plain = b.layer("container", "Plain", null, { "presence.exit": "fade" });
    setDocument(b.build());
    let left = 0;
    const els: Record<string, ReturnType<typeof fake>> = { [a]: fake(() => ({ left, top: 0 }), { translate: "1px 2px" }), [plain]: fake(() => ({ left, top: 0 })) };
    const driver = new LayoutDriver({ getDocument, node: (id) => els[id], live: () => false, reducedMotion: () => false });
    driver.update(DT);
    driver.update(DT);
    for (let i = 0; i < 10; i++) {
      left += 3; // carried along
      driver.update(DT);
    }
    assert.equal(els[a].style.getPropertyValue("translate"), "1px 2px", "moving steadily: untouched");
    left += 200;
    driver.update(DT);
    const drawn = left + translateX(els[a]);
    assert.ok(Math.abs(drawn - (left - 200)) < 25, `drawn about where it was (${drawn} of ${left - 200})`);
    assert.equal(els[plain].style.getPropertyValue("translate"), "", "a layer that didn't ask stays put");
    for (let i = 0; i < 300; i++) driver.update(DT);
    assert.equal(els[a].style.getPropertyValue("translate"), "1px 2px", "at rest: what was there before is back");
  });
  it("an entrance plays when the stage goes live and when a layer is made; reduced motion skips it", () => {
    const b = new DocBuilder();
    const card = b.layer("container", "Card", null, { "presence.enter": "rise" });
    setDocument(b.build());
    const els: Record<string, ReturnType<typeof fake>> = { [card]: fake(() => ({ left: 0, top: 0 })) };
    let live = false;
    let reduced = false;
    const driver = new LayoutDriver({ getDocument, node: (id) => els[id], live: () => live, reducedMotion: () => reduced, mover: () => viaMotion });
    driver.update(DT);
    assert.equal(els[card].style.getPropertyValue("opacity"), "", "not live: as drawn");
    live = true;
    driver.update(DT);
    const first = Number(els[card].style.getPropertyValue("opacity"));
    assert.ok(first < 0.2, `starts nearly absent (${first})`);
    assert.ok(translateY(els[card]) > 10, "and below its place");
    let last = first;
    for (let i = 0; i < 20; i++) {
      driver.update(DT);
      const o = Number(els[card].style.getPropertyValue("opacity") || 1);
      assert.ok(o >= last - 1e-6, "fading in");
      last = o;
    }
    for (let i = 0; i < 200; i++) driver.update(DT);
    assert.equal(els[card].style.getPropertyValue("opacity"), "");
    assert.equal(els[card].style.getPropertyValue("translate"), "");
    // a layer made while it runs
    const made = documentCommands.addLayer({ archetype: "container", parentId: null, name: "New", properties: { "presence.enter": "fade" } });
    els[made] = fake(() => ({ left: 0, top: 0 }));
    driver.update(DT);
    assert.ok(Number(els[made].style.getPropertyValue("opacity")) < 0.2);
    // reduced motion
    reduced = true;
    live = false;
    driver.update(DT);
    live = true;
    driver.update(DT);
    assert.equal(els[card].style.getPropertyValue("opacity"), "");
  });
  it("a deleted layer leaves a copy that plays the exit and is then removed", () => {
    const b = new DocBuilder();
    const card = b.layer("container", "Card", null, { "presence.exit": "scale" });
    setDocument(b.build());
    const el = fake(() => ({ left: 30, top: 40 }));
    const driver = new LayoutDriver({ getDocument, node: (id) => (id === card ? el : undefined), live: () => true, reducedMotion: () => false, mover: () => viaMotion });
    driver.update(DT);
    documentCommands.removeLayer(card);
    driver.update(DT);
    assert.equal(el.appended.length, 1, "a copy was put where the layer was");
    const ghost = el.appended[0] as ReturnType<typeof fake> & { removed: boolean; attrs: Record<string, string> };
    assert.equal(ghost.style.getPropertyValue("left"), "30px");
    assert.equal(ghost.style.getPropertyValue("top"), "40px");
    assert.equal(ghost.attrs["aria-hidden"], "true");
    assert.ok(Number(ghost.style.getPropertyValue("opacity")) > 0.5, "still mostly there on the first frame");
    for (let i = 0; i < 300 && !ghost.removed; i++) driver.update(DT);
    assert.equal(ghost.removed, true);
    assert.equal(driver.idle, true);
  });
});

describe("Phase 87: a layer's motion in Motion's words", () => {
  it("states are variants, gestures are while-props, the transition is the same spring", () => {
    const b = new DocBuilder();
    const btn = b.layer("container", "Button", null, { "transform.x": 0, "appearance.opacity": 1, "appearance.background.color": "#000000", "frame.width": 120 });
    setDocument(b.build());
    assert.equal(motionPropsOf(getDocument(), btn), null, "nothing to say for a layer with no motion");
    documentCommands.addState(btn, "hover", { "transform.x": 12, "appearance.background.color": "#ff0000", "frame.width": 140 }, "Add state");
    documentCommands.addState(btn, "pressed", { "transform.scale": 0.96 }, "Add state");
    documentCommands.addState(btn, "selected", { "appearance.opacity": 0.5 }, "Add state");
    run("layer.setTransition", { ids: [btn], type: "spring", duration: 0.4, bounce: 0.2 });
    run("layer.setTransitionOverride", { id: btn, property: "appearance.background.color", type: "tween", duration: 0.8 });
    run("layer.setLayoutMotion", { ids: [btn], on: true, exit: "fade" });
    const m = motionPropsOf(getDocument(), btn)!;
    assert.deepEqual(m.variants.hover, { x: 12, backgroundColor: "#ff0000", width: "140px" });
    assert.deepEqual(m.variants.pressed, { scale: 0.96 });
    assert.deepEqual(m.variants.rest, { x: 0, backgroundColor: "#000000", width: "120px", scale: 1, opacity: 1 });
    assert.equal(m.whileHover, "hover");
    assert.equal(m.whileTap, "pressed");
    assert.equal(m.whileFocus, undefined);
    assert.deepEqual(m.custom, ["selected"]);
    assert.equal(m.animate, "rest");
    assert.equal(m.layout, true);
    assert.deepEqual(m.exit, { opacity: 0 });
    const t = m.transition as unknown as { default: { type: string; stiffness: number }; backgroundColor: { type: string; duration: number } };
    assert.equal(t.default.type, "spring");
    assert.deepEqual(t.backgroundColor, { type: "tween", duration: 0.8, ease: [0.215, 0.61, 0.355, 1] });
    // the spring Motion is told to use is the one the stage draws
    const spec = { type: "spring" as const, duration: 0.4, bounce: 0.2, curve: "power2.out" };
    const told = motionTransition(spec) as { stiffness: number; damping: number; mass: number };
    const g = motion.spring({ keyframes: [0, 1], ...told, velocity: 0 });
    const mine = new Mover(spec);
    mine.to(1);
    for (let i = 1; i <= 30; i++) {
      mine.step(DT);
      assert.ok(Math.abs(g.next(i * DT * 1000).value - mine.value) < 2e-3);
    }
    assert.equal(motionKey("transform.rotate"), "rotate");
    assert.equal(motionKey("content.text"), null);
  });
});
