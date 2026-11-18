import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { StateDriver } from "../../engine/stage/StateDriver";
import { getTransport, transport } from "../../time/transport";
import { useCanvasViewStore } from "../../store/useCanvasViewStore";
import { usePlaygroundStore } from "../../store/usePlaygroundStore";
import { registerPlaygroundCommands } from "../playgroundCommands";
import { MAX_SCALE, MIN_SCALE, TIME_SCALES, TOUCH_MIN, clampScale, dimensionLabel, interactiveIds, smallTouchTargets } from "../playground";

/** ROADMAP Phase 90: the Playground drives what exists and adds a held state, overlays and their numbers. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: { ok?: boolean; on?: boolean; rate?: number; code?: string } }).result ?? {};
let off: () => void;
let btn = "";
let plain = "";
beforeEach(() => {
  const b = new DocBuilder();
  btn = b.layer("container", "Button", null, { "appearance.opacity": 1, "transform.x": 0 });
  plain = b.layer("container", "Plain", null, {});
  b.state(btn, "hover", { "transform.x": 40 });
  b.state(btn, "pressed", { "transform.x": 80 });
  setDocument(b.build());
  useCanvasViewStore.getState().setMode("design");
  usePlaygroundStore.getState().setOpen(false);
  transport.setRate(1);
  off = registerPlaygroundCommands();
});
afterEach(() => {
  off();
  usePlaygroundStore.getState().setOpen(false);
  useCanvasViewStore.getState().setMode("design");
});

describe("Phase 90: the numbers", () => {
  it("speeds run from a tenth to double, and anything else is kept inside", () => {
    assert.equal(TIME_SCALES[0], MIN_SCALE);
    assert.equal(TIME_SCALES[TIME_SCALES.length - 1], MAX_SCALE);
    assert.equal(clampScale(0.01), 0.1);
    assert.equal(clampScale(5), 2);
    assert.equal(clampScale(0.333), 0.33);
    assert.equal(clampScale(Number.NaN), 1);
  });
  it("a tap target is a layer that links, has states or switches its variant; small ones are under 44 px either way", () => {
    const doc = getDocument();
    assert.deepEqual([...interactiveIds(doc)], [btn]);
    const boxes = [
      { id: btn, name: "Button", x: 0, y: 0, w: 120, h: 30 },
      { id: plain, name: "Plain", x: 0, y: 0, w: 10, h: 10 },
      { id: "x", name: "Big", x: 0, y: 0, w: 200, h: 200 },
    ];
    assert.deepEqual(smallTouchTargets(boxes, interactiveIds(doc)).map((b) => b.id), [btn], "30 is short; the plain layer is not a target; a big one is fine");
    assert.equal(TOUCH_MIN, 44);
    assert.equal(dimensionLabel({ w: 119.6, h: 47.2 }), "120 × 47");
  });
});

describe("Phase 90: the commands", () => {
  it("view.playground goes to Preview and back to where it was", () => {
    assert.equal(run("view.playground", {}).on, true);
    assert.equal(usePlaygroundStore.getState().open, true);
    assert.equal(useCanvasViewStore.getState().mode, "preview");
    assert.equal(run("view.playground", {}).on, false);
    assert.equal(usePlaygroundStore.getState().open, false);
    assert.equal(useCanvasViewStore.getState().mode, "design");
  });
  it("closing clears what was held and the overlays", () => {
    run("view.playground", { on: true });
    run("playground.hold", { layerId: btn, name: "hover" });
    run("playground.overlay", { overlay: "touch", on: true });
    run("view.playground", { on: false });
    assert.equal(usePlaygroundStore.getState().held, null);
    assert.deepEqual(usePlaygroundStore.getState().overlays, []);
  });
  it("speed goes to the transport, kept between a tenth and double", () => {
    assert.equal(run("playground.timeScale", { scale: 0.25 }).rate, 0.25);
    assert.equal(getTransport().rate, 0.25);
    assert.equal(run("playground.timeScale", { scale: 9 }).rate, 2);
    assert.equal(getTransport().rate, 2);
  });
  it("only a state the layer has can be held", () => {
    assert.equal(run("playground.hold", { layerId: btn, name: "hover" }).ok, true);
    assert.deepEqual(usePlaygroundStore.getState().held, { layerId: btn, name: "hover" });
    assert.equal(run("playground.hold", { layerId: btn, name: "nope" }).ok, false);
    assert.equal(run("playground.hold", { layerId: plain, name: "hover" }).ok, false);
    assert.equal(run("playground.hold", { layerId: btn, name: null }).ok, true);
    assert.equal(usePlaygroundStore.getState().held, null);
  });
  it("overlays turn on and off without duplicates", () => {
    run("playground.overlay", { overlay: "box", on: true });
    run("playground.overlay", { overlay: "box", on: true });
    run("playground.overlay", { overlay: "touch", on: true });
    assert.deepEqual([...usePlaygroundStore.getState().overlays], ["box", "touch"]);
    run("playground.overlay", { overlay: "box", on: false });
    assert.deepEqual([...usePlaygroundStore.getState().overlays], ["touch"]);
  });
  it("none of it changes the design", () => {
    const before = JSON.stringify(getDocument());
    run("view.playground", { on: true });
    run("playground.hold", { layerId: btn, name: "pressed" });
    run("playground.overlay", { overlay: "wireframe", on: true });
    run("playground.timeScale", { scale: 0.5 });
    run("view.playground", { on: false });
    assert.equal(JSON.stringify(getDocument()), before);
  });
});

describe("Phase 90: holding a state on the stage", () => {
  const DT = 1 / 60;
  const make = (live: boolean) => {
    const driver = new StateDriver({
      getDocument,
      source: { pointer: () => null, pageSize: () => ({ width: 800, height: 600 }), scroll: () => ({ y: 0, max: 0 }), layerRect: () => null },
      editing: () => null,
      live: () => live,
      held: () => usePlaygroundStore.getState().held,
      reducedMotion: () => false,
    });
    const comp = Object.keys(getDocument().compositions)[0];
    const x = () => evaluate(getDocument(), comp, btn, 0, { stateMix: driver.update(DT)?.stateMix })["transform.x"] as number;
    return { x };
  };
  it("a held state is reached on the layer's transition, and released goes back", () => {
    const { x } = make(true);
    assert.equal(x(), 0);
    run("playground.hold", { layerId: btn, name: "hover" });
    const first = x();
    assert.ok(first > 0 && first < 40, `on its way (${first})`);
    let v = first;
    for (let i = 0; i < 90; i++) v = x();
    assert.equal(v, 40);
    run("playground.hold", { layerId: btn, name: "pressed" });
    for (let i = 0; i < 90; i++) v = x();
    assert.equal(v, 80);
    run("playground.hold", { layerId: btn, name: null });
    for (let i = 0; i < 120; i++) v = x();
    assert.equal(v, 0);
  });
  it("holding works with live off too, and nothing is held by default", () => {
    const { x } = make(false);
    for (let i = 0; i < 5; i++) assert.equal(x(), 0);
    run("playground.hold", { layerId: btn, name: "hover" });
    let v = 0;
    for (let i = 0; i < 90; i++) v = x();
    assert.equal(v, 40);
  });
});
