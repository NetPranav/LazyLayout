import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { documentCommands, historyCommands } from "../../store/useDocumentStore";
import { useSelectionStore } from "../../store/useSelectionStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { StateDriver } from "../../engine/stage/StateDriver";
import { useStateEditStore } from "../stateEdit";
import { registerStateCommands } from "../stateCommands";
import { mergeStateProps, pickLiveState, stepBlend, statesOf } from "../states";

let off: () => void;
let btn = "";
beforeEach(() => {
  const b = new DocBuilder();
  btn = b.layer("container", "Button", null, { "appearance.opacity": 1, "transform.x": 0 });
  setDocument(b.build());
  useSelectionStore.getState().select(btn, "layer");
  useStateEditStore.getState().edit(null, null);
  off = registerStateCommands();
});
afterEach(() => {
  off();
  useStateEditStore.getState().edit(null, null);
});

const comp = () => Object.keys(getDocument().compositions)[0] ?? "main";

describe("states (D15)", () => {
  it("add, refuse a duplicate, remove", () => {
    assert.equal((tryRunCommand("layer.addState", { id: btn, name: "hover" }) as { ok: boolean }).ok, true);
    assert.equal(statesOf(getDocument(), btn).length, 1);
    const dup = tryRunCommand("layer.addState", { id: btn, name: "Hover" });
    assert.equal((dup.ok ? (dup.result as { code?: string }) : {}).code, "STATE_EXISTS");
    tryRunCommand("layer.removeState", { id: btn, name: "hover" });
    assert.equal(statesOf(getDocument(), btn).length, 0);
  });

  it("while a state is edited, a change goes to the state, and only the difference from the base is kept", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover" }); // starts editing it
    documentCommands.updateProps(btn, { "appearance.opacity": 0.5, "transform.x": 0 });
    const [row] = statesOf(getDocument(), btn);
    assert.equal(row.props["appearance.opacity"], 0.5);
    assert.equal("transform.x" in row.props, false); // equal to the base: nothing stored
    assert.equal(getDocument().layers[btn].properties["appearance.opacity"], 1); // the base is untouched
    // back to the base value drops it from the state
    documentCommands.updateProps(btn, { "appearance.opacity": 1 });
    assert.deepEqual(statesOf(getDocument(), btn)[0].props, {});
  });

  it("with no state being edited, a change is the base's", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover" });
    tryRunCommand("layer.editState", { id: btn, name: null });
    documentCommands.updateProps(btn, { "transform.x": 12 });
    assert.equal(getDocument().layers[btn].properties["transform.x"], 12);
  });

  it("state edits are one undo step", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover" });
    documentCommands.updateProps(btn, { "appearance.opacity": 0.4 });
    historyCommands.undo();
    assert.deepEqual(statesOf(getDocument(), btn)[0].props, {});
  });

  it("the kernel applies an active state, and blends numbers by the amount", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover" });
    documentCommands.updateProps(btn, { "appearance.opacity": 0.5, "transform.x": 40 });
    const doc = getDocument();
    const at = (inputs: Parameters<typeof evaluate>[4]) => evaluate(doc, comp(), btn, 0, inputs);
    assert.equal(at({})["appearance.opacity"], 1);
    assert.equal(at({ activeStates: { [btn]: "hover" } })["transform.x"], 40);
    const half = at({ activeStates: { [btn]: "hover" }, stateBlend: { [btn]: 0.5 } });
    assert.equal(half["appearance.opacity"], 0.75);
    assert.equal(half["transform.x"], 20);
    assert.equal(at({ activeStates: { [btn]: "hover" }, stateBlend: { [btn]: 0 } })["transform.x"], 0);
  });

  it("pressed beats focus beats hover", () => {
    const all = new Set(["hover", "pressed", "focus"]);
    assert.equal(pickLiveState(all, { hover: true, pressed: true, focus: true }), "pressed");
    assert.equal(pickLiveState(all, { hover: true, pressed: false, focus: true }), "focus");
    assert.equal(pickLiveState(all, { hover: true, pressed: false, focus: false }), "hover");
    assert.equal(pickLiveState(new Set(["pressed"]), { hover: true, pressed: false, focus: false }), undefined);
  });

  it("mergeStateProps and stepBlend", () => {
    assert.deepEqual(mergeStateProps({ a: 1 }, { b: 2 }, { a: 1, b: undefined, c: 3 }), { c: 3 });
    let v = 0;
    for (let i = 0; i < 60; i++) v = stepBlend(v, 1, 1 / 60);
    assert.equal(v, 1);
    // the same at 30 and 120 fps after one second
    const run = (fps: number) => { let x = 0; for (let i = 0; i < fps; i++) x = stepBlend(x, 1, 1 / fps); return x; };
    assert.ok(Math.abs(run(30) - run(120)) < 0.01);
  });
});

describe("StateDriver (D15)", () => {
  const rect = { x: 0, y: 0, width: 100, height: 40 };
  const make = (pointer: { x: number; y: number; down: boolean } | null, opts: { live?: boolean; reduced?: boolean } = {}) => {
    let p = pointer;
    const driver = new StateDriver({
      getDocument,
      source: {
        pointer: () => (p ? { ...p, coarse: false, pressure: 0.5, type: "mouse" as const } : null),
        pageSize: () => ({ width: 800, height: 600 }),
        scroll: () => ({ y: 0, max: 0 }),
        layerRect: (id) => (id === btn ? rect : null),
      },
      editing: () => { const e = useStateEditStore.getState(); return e.layerId && e.name ? { layerId: e.layerId, name: e.name } : null; },
      live: () => opts.live ?? true,
      reducedMotion: () => opts.reduced ?? false,
    });
    return { driver, move: (next: typeof p) => { p = next; } };
  };

  it("idle with no states", () => {
    tryRunCommand("layer.editState", { id: btn, name: null });
    const { driver } = make({ x: 10, y: 10, down: false });
    assert.equal(driver.idle, true);
    assert.equal(driver.update(1 / 60), null);
  });

  it("hover eases in over the layer and out when the pointer leaves, and is gone at the end", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover", edit: false });
    const { driver, move } = make({ x: 10, y: 10, down: false });
    let f = driver.update(1 / 60)!;
    assert.equal(f.activeStates[btn], "hover");
    assert.ok(f.stateBlend[btn] > 0 && f.stateBlend[btn] < 1);
    for (let i = 0; i < 60; i++) f = driver.update(1 / 60)!;
    assert.equal(f.stateBlend[btn], 1);
    move({ x: 500, y: 500, down: false });
    for (let i = 0; i < 90; i++) f = driver.update(1 / 60)!;
    assert.equal(f.activeStates[btn], undefined);
    driver.update(1 / 60);
    assert.equal(driver.changed, false); // nothing to redraw once it has settled
  });

  it("pressed wins over hover, and reduced motion switches at once", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover", edit: false });
    tryRunCommand("layer.addState", { id: btn, name: "pressed", edit: false });
    const { driver } = make({ x: 10, y: 10, down: true }, { reduced: true });
    const f = driver.update(1 / 60)!;
    assert.equal(f.activeStates[btn], "pressed");
    assert.equal(f.stateBlend[btn], 1);
  });

  it("not live: nothing shows, except the state being edited, shown in full", () => {
    tryRunCommand("layer.addState", { id: btn, name: "hover", edit: false });
    const { driver } = make({ x: 10, y: 10, down: false }, { live: false });
    assert.equal(driver.idle, true);
    tryRunCommand("layer.editState", { id: btn, name: "hover" });
    assert.equal(driver.idle, false);
    const f = driver.update(1 / 60)!;
    assert.deepEqual([f.activeStates[btn], f.stateBlend[btn]], ["hover", 1]);
  });
});
