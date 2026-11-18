import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { getPropertyDefinition } from "../../document/properties";
import { setDocument, getDocument } from "../../store/documentState";
import { documentCommands, historyCommands } from "../../store/useDocumentStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { StateDriver } from "../../engine/stage/StateDriver";
import { useStateEditStore } from "../stateEdit";
import { registerTransitionCommands } from "../transitionCommands";
import { Mover, TRANSITION_DEFAULT, transitionOf, transitionOverrides, type TransitionSpec } from "../transitions";

/** ROADMAP Phase 79: transitions between states, and interruption that keeps velocity. */
const SPRING: TransitionSpec = { type: "spring", duration: 0.35, bounce: 0.15, curve: "power2.out" };
const TWEEN: TransitionSpec = { type: "tween", duration: 0.3, bounce: 0, curve: "linear" };
const DT = 1 / 60;
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; code?: string; slot?: number };

let off: () => void;
let btn = "";
beforeEach(() => {
  const b = new DocBuilder();
  btn = b.layer("container", "Button", null, { "appearance.opacity": 1, "transform.x": 0, "appearance.background.color": "#000000" });
  setDocument(b.build());
  useStateEditStore.getState().edit(null, null);
  off = registerTransitionCommands();
});
afterEach(() => off());
const comp = () => Object.keys(getDocument().compositions)[0] ?? "main";

describe("Phase 79: one number on a transition", () => {
  it("a spring gets there in about its time, overshoots by its bounce, and comes to rest exactly", () => {
    const m = new Mover(SPRING);
    m.to(1);
    let peak = 0;
    let at = 0;
    for (let i = 0; i < 120; i++) {
      peak = Math.max(peak, m.step(DT));
      if (at === 0 && m.value > 0.9) at = (i + 1) * DT;
    }
    assert.ok(at > 0.1 && at < 0.4, `nearly there in about its time (${at}s)`);
    assert.ok(peak > 1 && peak < 1.2, `a little overshoot (${peak})`);
    assert.equal(m.value, 1);
    assert.equal(m.resting, true);
    const flat = new Mover({ ...SPRING, bounce: 0 });
    flat.to(1);
    let top = 0;
    for (let i = 0; i < 120; i++) top = Math.max(top, flat.step(DT));
    assert.ok(top <= 1.0001, "no bounce, no overshoot");
  });
  it("an interrupted spring keeps its speed: the value and the velocity are continuous through the turn", () => {
    const m = new Mover(SPRING);
    m.to(1);
    for (let i = 0; i < 6; i++) m.step(DT);
    const before = { value: m.value, velocity: m.velocity };
    assert.ok(before.velocity > 1, "moving fast towards 1");
    m.to(0);
    assert.equal(m.value, before.value, "turning round does not move it");
    assert.equal(m.velocity, before.velocity, "nor change its speed");
    const next = m.step(DT);
    assert.ok(next > before.value, "it carries on the way it was going for a moment");
    assert.ok(m.velocity < before.velocity, "while slowing down");
  });
  it("a 2-state toggle clicked 10 times quickly never snaps", () => {
    const m = new Mover(SPRING);
    let last = m.value;
    let lastVelocity = 0;
    let biggestStep = 0;
    let biggestKick = 0;
    for (let click = 0; click < 10; click++) {
      m.to(click % 2 === 0 ? 1 : 0);
      // four frames between clicks: far too quick for any one move to finish
      for (let i = 0; i < 4; i++) {
        const v = m.step(DT);
        biggestStep = Math.max(biggestStep, Math.abs(v - last));
        biggestKick = Math.max(biggestKick, Math.abs(m.velocity - lastVelocity));
        last = v;
        lastVelocity = m.velocity;
      }
    }
    // a snap would be a step of most of the way in one frame; a spring at this setting never moves 15% in a frame
    assert.ok(biggestStep < 0.15, `the biggest move in one frame was ${biggestStep}`);
    // the speed changes by what the spring's pull allows in a frame (about 3.7 a frame at most here), never by a jump
    assert.ok(biggestKick < 5, `the speed never jumped (${biggestKick} a frame)`);
    for (let i = 0; i < 200; i++) m.step(DT);
    assert.equal(m.value, 0, "and it ends where the last click sent it");
  });
  it("a tween takes exactly its time and starts again from where it is when interrupted", () => {
    const m = new Mover(TWEEN);
    m.to(1);
    for (let i = 0; i < 9; i++) m.step(DT);
    assert.ok(Math.abs(m.value - 0.5) < 0.001, `half way at half time (${m.value})`);
    m.to(0);
    const from = m.value;
    m.step(DT);
    assert.ok(m.value < from && m.value > from - 0.05, "it turns at once, from where it was, with no jump");
    for (let i = 0; i < 18; i++) m.step(DT);
    assert.equal(m.value, 0);
  });
  it("the same steps give the same numbers", () => {
    const sample = () => { const m = new Mover(SPRING); m.to(1); const out: number[] = []; for (let i = 0; i < 30; i++) out.push(m.step(DT)); return out; };
    assert.deepEqual(sample(), sample());
  });
});

describe("Phase 79: the settings", () => {
  it("a layer's transition has defaults, and a property can have one of its own", () => {
    assert.deepEqual(transitionOf({}), TRANSITION_DEFAULT);
    assert.equal(transitionOf({}).type, "spring", "a spring is the default for interactions");
    assert.deepEqual(transitionOf({ "transition.type": "tween", "transition.duration": 0.5, "transition.curve": "linear" }), { type: "tween", duration: 0.5, bounce: 0.15, curve: "linear" });
    assert.equal(transitionOf({ "transition.duration": 99 }).duration, 10, "clamped");
    const o = transitionOverrides({ "transition.duration": 0.2, "transition.1.property": "appearance.opacity", "transition.1.type": "tween", "transition.1.duration": 1, "transition.2.property": "" });
    assert.deepEqual([...o.keys()], ["appearance.opacity"]);
    assert.deepEqual(o.get("appearance.opacity"), { type: "tween", duration: 1, bounce: 0.15, curve: "power2.out" });
    for (const path of ["transition.type", "transition.duration", "transition.bounce", "transition.curve", "transition.1.property", "transition.3.duration"]) assert.ok(getPropertyDefinition(path), path);
  });
  it("layer.setTransition and layer.setTransitionOverride write them; one undo step; a property no state changes is refused", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100, "appearance.opacity": 0.5 }, "Add state");
    assert.equal(run("layer.setTransition", { ids: [btn], type: "tween", duration: 0.6, curve: "linear" }).ok, true);
    assert.deepEqual(transitionOf(getDocument().layers[btn].properties), { type: "tween", duration: 0.6, bounce: 0.15, curve: "linear" });
    historyCommands.undo();
    assert.deepEqual(transitionOf(getDocument().layers[btn].properties), TRANSITION_DEFAULT);

    assert.equal(run("layer.setTransitionOverride", { id: btn, property: "frame.width" }).code, "NOT_IN_A_STATE");
    assert.equal(run("layer.setTransitionOverride", { id: btn, property: "appearance.opacity", type: "tween", duration: 1 }).slot, 1);
    assert.equal(run("layer.setTransitionOverride", { id: btn, property: "appearance.opacity", duration: 2 }).slot, 1, "the same property again edits its own slot");
    assert.equal(transitionOverrides(getDocument().layers[btn].properties).get("appearance.opacity")!.duration, 2);
    assert.equal(run("layer.setTransitionOverride", { id: btn, slot: 2, property: "appearance.opacity" }).code, "DUPLICATE");
    assert.equal(run("layer.setTransitionOverride", { id: btn, slot: 1, property: null }).ok, true);
    assert.equal(transitionOverrides(getDocument().layers[btn].properties).size, 0);
  });
});

describe("Phase 79: the kernel mixes every state a layer is partly in", () => {
  const at = (stateMix: Record<string, Array<{ name: string; amount: number; amounts?: Record<string, number> }>>) => evaluate(getDocument(), comp(), btn, 0, { stateMix });
  it("numbers follow the share, past 1 when a spring overshoots; a colour mixes instead of switching", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100, "appearance.background.color": "#ffffff" }, "Add state");
    assert.equal(at({ [btn]: [{ name: "hover", amount: 0.25 }] })["transform.x"], 25);
    assert.ok(Math.abs((at({ [btn]: [{ name: "hover", amount: 1.1 }] })["transform.x"] as number) - 110) < 1e-9);
    const grey = at({ [btn]: [{ name: "hover", amount: 0.5 }] })["appearance.background.color"] as string;
    assert.notEqual(grey, "#000000");
    assert.notEqual(grey, "#ffffff");
    assert.equal(at({ [btn]: [{ name: "hover", amount: 1 }] })["appearance.background.color"], "#ffffff");
    assert.equal(at({ [btn]: [{ name: "hover", amount: 0 }] })["transform.x"], 0);
  });
  it("a property the base layer doesn't set blends from its default, instead of switching half way", () => {
    documentCommands.addState(btn, "hover", { "transform.rotate": 90, "transform.scale": 2 }, "Add state");
    assert.equal(getDocument().layers[btn].properties["transform.rotate"], undefined);
    assert.equal(at({ [btn]: [{ name: "hover", amount: 0.1 }] })["transform.rotate"], 9);
    assert.ok(Math.abs((at({ [btn]: [{ name: "hover", amount: 0.1 }] })["transform.scale"] as number) - 1.1) < 1e-9, "scale starts from 1");
    assert.equal(at({ [btn]: [{ name: "hover", amount: 0 }] })["transform.rotate"], undefined, "untouched at 0");
  });
  it("two states cross: one fading out under one arriving", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100 }, "Add state");
    documentCommands.addState(btn, "pressed", { "transform.x": 40, "appearance.opacity": 0.5 }, "Add state");
    const mid = at({ [btn]: [{ name: "hover", amount: 0.5 }, { name: "pressed", amount: 0.5 }] });
    // base 0 -> half way to hover's 100 is 50 -> half way from there to pressed's 40 is 45
    assert.equal(mid["transform.x"], 45);
    assert.equal(mid["appearance.opacity"], 0.75);
  });
  it("a property with a transition of its own uses its own share", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100, "appearance.opacity": 0 }, "Add state");
    const r = at({ [btn]: [{ name: "hover", amount: 1, amounts: { "appearance.opacity": 0.25 } }] });
    assert.equal(r["transform.x"], 100);
    assert.equal(r["appearance.opacity"], 0.75);
  });
});

describe("Phase 79: the stage's driver", () => {
  const rect = { x: 0, y: 0, width: 100, height: 40 };
  const make = (pointer: { x: number; y: number; down: boolean } | null, reduced = false) => {
    let p = pointer;
    const driver = new StateDriver({
      getDocument,
      source: { pointer: () => (p ? { ...p, coarse: false, pressure: 0.5, type: "mouse" as const } : null), pageSize: () => ({ width: 800, height: 600 }), scroll: () => ({ y: 0, max: 0 }), layerRect: (id) => (id === btn ? rect : null) },
      editing: () => null,
      live: () => true,
      reducedMotion: () => reduced,
    });
    const x = () => evaluate(getDocument(), comp(), btn, 0, { stateMix: driver.update(DT)?.stateMix })["transform.x"] as number;
    return { driver, x, move: (next: typeof p) => { p = next; } };
  };
  const IN = { x: 10, y: 10, down: false };
  const OUT = { x: 500, y: 500, down: false };

  it("the reference: a toggle hovered in and out 10 times quickly never snaps, and ends at rest", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100 }, "Add state");
    const { x, move, driver } = make(OUT);
    let last = x();
    let biggest = 0;
    for (let i = 0; i < 10; i++) {
      move(i % 2 === 0 ? IN : OUT);
      for (let f = 0; f < 4; f++) {
        const now = x();
        biggest = Math.max(biggest, Math.abs(now - last));
        last = now;
      }
    }
    assert.ok(biggest < 15, `the layer never moved more than ${biggest} of its 100 px in a frame`);
    assert.ok(last > 0 && last < 100, "it is somewhere on the way, not at an end");
    for (let f = 0; f < 240; f++) last = x();
    assert.equal(last, 0, "the last move was out: it comes back to rest");
    assert.equal(driver.update(DT)!.stateMix[btn], undefined, "nothing of the state is left");
    driver.update(DT);
    assert.equal(driver.changed, false, "and there is nothing more to redraw");
  });
  it("hover gives way to pressed without passing through the base: both are in the mix on the way", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100 }, "Add state");
    documentCommands.addState(btn, "pressed", { "transform.x": 100, "appearance.opacity": 0.5 }, "Add state");
    const { driver, move } = make(IN);
    for (let f = 0; f < 120; f++) driver.update(DT);
    move({ ...IN, down: true });
    let lowest = 100;
    let both = false;
    for (let f = 0; f < 120; f++) {
      const frame = driver.update(DT)!;
      if ((frame.stateMix[btn] ?? []).length === 2) both = true;
      lowest = Math.min(lowest, evaluate(getDocument(), comp(), btn, 0, { stateMix: frame.stateMix })["transform.x"] as number);
    }
    assert.equal(both, true, "hover fades while pressed arrives");
    // both states put x at 100: crossing straight from one to the other must not dip towards the base's 0
    assert.ok(lowest > 60, `x stayed near 100 through the change (lowest ${lowest})`);
    const end = driver.update(DT)!;
    assert.deepEqual(end.stateMix[btn].map((s) => [s.name, s.amount]), [["pressed", 1]]);
    assert.equal(end.activeStates[btn], "pressed");
  });
  it("a property with its own slow tween lags the spring; reduced motion switches at once", () => {
    documentCommands.addState(btn, "hover", { "transform.x": 100, "appearance.opacity": 0 }, "Add state");
    run("layer.setTransitionOverride", { id: btn, property: "appearance.opacity", type: "tween", duration: 2 });
    const { driver } = make(IN);
    let frame = driver.update(DT)!;
    for (let f = 0; f < 60; f++) frame = driver.update(DT)!;
    const share = frame.stateMix[btn][0];
    assert.equal(share.amount, 1, "the spring has arrived after a second");
    // half its time along an ease-out curve is about three quarters of the way
    assert.ok(share.amounts!["appearance.opacity"] > 0.6 && share.amounts!["appearance.opacity"] < 0.9, `the 2-second tween is still on its way (${share.amounts!["appearance.opacity"]})`);
    const quick = make(IN, true);
    assert.deepEqual(quick.driver.update(DT)!.stateMix[btn], [{ name: "hover", amount: 1, amounts: { "appearance.opacity": 1 } }]);
  });
});
