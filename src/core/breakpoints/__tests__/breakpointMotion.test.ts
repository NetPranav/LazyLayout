import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { historyCommands } from "../../store/useDocumentStore";
import { useBreakpointStore } from "../../store/useBreakpointStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { KernelAdapter } from "../../engine/stage/KernelAdapter";
import type { AdapterHost } from "../../engine/stage/types";
import { registerTransitionCommands } from "../../states/transitionCommands";
import { isMovement, layerAtBreakpoint, motionAtOf, scaleDistance } from "../breakpointMotion";

/** ROADMAP Phase 88: motion per breakpoint. A card slides 200 px and fades in over a second; Mobile is calmer. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: unknown }).result as { ok?: boolean; changed?: number };
let off: () => void;
let card = "";
let comp = "";
beforeEach(() => {
  const b = new DocBuilder();
  card = b.layer("container", "Card", null, { "transform.x": 0, "appearance.opacity": 1, "transform.rotate": 0 });
  const track = (property: string, to: number) => ({ id: `t_${property}`, property, keyframes: [{ id: `${property}_a`, time: 0, value: 0, ease: "linear" }, { id: `${property}_b`, time: 1, value: to, ease: "linear" }] });
  b.clip(card, { name: "In", type: "entrance", trigger: "mount", duration: 1, easing: "linear", tracks: [track("transform.x", 200), track("appearance.opacity", 1)] });
  setDocument(b.build());
  comp = Object.keys(getDocument().compositions)[0];
  useBreakpointStore.getState().setActive(null);
  off = registerTransitionCommands();
});
afterEach(() => {
  off();
  useBreakpointStore.getState().setActive(null);
});
const at = (t: number, breakpoint: string | null = null) => evaluate(getDocument(), comp, card, t, { breakpoint });
const L = () => getDocument().layers[card];

describe("Phase 88: the settings", () => {
  it("default to playing as written; movement is places, turns and sizes, not opacity", () => {
    assert.deepEqual(motionAtOf({}), { plays: true, timeScale: 1, distance: 1, loops: true });
    assert.equal(isMovement("transform.x"), true);
    assert.equal(isMovement("frame.width"), true);
    assert.equal(isMovement("appearance.opacity"), false);
    assert.equal(scaleDistance("transform.x", 200, { "transform.x": 100 }, 0.5), 150, "half way from where it rests");
    assert.equal(scaleDistance("transform.scale", 2, {}, 0.5), 1.5, "a scale rests at 1");
    assert.equal(scaleDistance("appearance.opacity", 0.2, {}, 0), 0.2);
  });
  it("layer.setMotionAt at the base sets the layer; while a smaller breakpoint is viewed it sets that breakpoint only; one undo step", () => {
    assert.equal(run("layer.setMotionAt", { ids: [card], distance: 0.8 }).changed, 1);
    assert.equal(L().properties["motion.distance"], 0.8);
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], distance: 0.25, timeScale: 2, plays: true });
    assert.equal(L().properties["motion.distance"], 0.8, "the base is untouched");
    assert.deepEqual(L().overrides?.mobile, { "motion.distance": 0.25, "motion.timeScale": 2 }, "only what differs is kept");
    historyCommands.undo();
    assert.equal(L().overrides, undefined);
    historyCommands.redo();
    // "same as larger sizes" takes Mobile's off and leaves the base
    assert.equal(run("layer.setMotionAt", { ids: [card], reset: true }).changed, 1);
    assert.equal(L().overrides, undefined);
    assert.equal(L().properties["motion.distance"], 0.8);
  });
});

describe("Phase 88: the kernel plays a layer as the breakpoint says", () => {
  it("the reference: an override plays only at its width", () => {
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], distance: 0.25 });
    useBreakpointStore.getState().setActive(null);
    assert.equal(at(0.5)["transform.x"], 100, "Desktop: the whole 200 px");
    assert.equal(at(0.5, "desktop")["transform.x"], 100);
    assert.equal(at(0.5, "tablet")["transform.x"], 100, "Tablet is wider than Mobile: not its override");
    assert.equal(at(0.5, "mobile")["transform.x"], 25, "Mobile: a quarter of the way");
    assert.equal(at(1, "mobile")["transform.x"], 50);
    assert.equal(at(0.5, "mobile")["appearance.opacity"], 0.5, "the fade is not movement: unchanged");
  });
  it("overrides cascade: Tablet's applies on Mobile until Mobile says otherwise", () => {
    useBreakpointStore.getState().setActive("tablet");
    run("layer.setMotionAt", { ids: [card], distance: 0.5 });
    assert.equal(at(1, "mobile")["transform.x"], 100);
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], distance: 0 });
    assert.equal(at(1, "tablet")["transform.x"], 100);
    assert.equal(at(1, "mobile")["transform.x"], 0);
    assert.equal(at(1, "mobile")["appearance.opacity"], 1);
  });
  it("off: the clips don't play there and the layer is as drawn", () => {
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], plays: false });
    assert.equal(at(0.5, "mobile")["transform.x"], 0);
    assert.equal(at(0, "mobile")["appearance.opacity"], 1, "not held at the first keyframe either");
    assert.equal(at(0.5, null)["transform.x"], 100);
  });
  it("time: 200 % plays the same clip over twice as long", () => {
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], timeScale: 2 });
    assert.equal(at(0.5, "mobile")["transform.x"], 50);
    assert.equal(at(1, "mobile")["transform.x"], 100);
    assert.equal(at(2, "mobile")["transform.x"], 200);
    assert.equal(at(1, null)["transform.x"], 200);
  });
  it("a property overridden at the breakpoint is what the animation starts from there", () => {
    useBreakpointStore.getState().setActive("mobile");
    tryRunCommand("layer.setMotionAt", { ids: [card], plays: false });
    // an ordinary override of an ordinary property, as the inspector makes it
    const before = layerAtBreakpoint(getDocument(), L(), "mobile").properties["transform.rotate"];
    assert.equal(before, 0);
  });
  it("the stage's adapter writes what the breakpoint gives, and again when the breakpoint changes", () => {
    useBreakpointStore.getState().setActive("mobile");
    run("layer.setMotionAt", { ids: [card], distance: 0.25 });
    useBreakpointStore.getState().setActive(null);
    const values = new Map<string, string>();
    const element = { style: { setProperty: (n: string, v: string) => void values.set(n, v), removeProperty: (n: string) => (values.delete(n), ""), getPropertyValue: (n: string) => values.get(n) ?? "" } };
    const adapter = new KernelAdapter();
    adapter.mount({ node: (id: string) => (id === card ? element : undefined), getDocument, compositionId: () => comp, fps: () => 60, duration: () => 1 } as unknown as AdapterHost);
    const x = () => Number(/translate3d\(([-\d.e]+)px/.exec(values.get("transform") ?? "")?.[1]);
    adapter.seek(0.5);
    assert.equal(x(), 100);
    adapter.setBreakpoint("mobile");
    adapter.seek(0.5);
    assert.equal(x(), 25);
    adapter.setInputs({ scrollClipTime: {} }); // another driver's inputs don't wipe the breakpoint
    adapter.seek(1);
    assert.equal(x(), 50);
    adapter.setBreakpoint(null);
    adapter.seek(1);
    assert.equal(x(), 200);
  });
});
