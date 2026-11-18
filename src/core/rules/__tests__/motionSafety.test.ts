import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { historyCommands } from "../../store/useDocumentStore";
import { tryRunCommand } from "../../commands";
import { exceedsFlashLimit } from "../accessibility";
import { PAUSE_AFTER_SECONDS, motionSafety, runTimeOf, safetySummary } from "../motionSafety";
import { registerMotionSafetyCommands } from "../motionSafetyCommands";
import { registerStateCommands } from "../../states/stateCommands";

/** ROADMAP Phase 93 (second half): flashing, long loops, tap targets and focus, as one list with fixes. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: { ok?: boolean; changed?: number } }).result ?? {};
const track = (property: string, values: number[], span: number) => ({ id: `t_${property}`, property, keyframes: values.map((v, i) => ({ id: `${property}_${i}`, time: (span * i) / (values.length - 1), value: v, ease: "linear" })) });
let offs: Array<() => void> = [];
let flasher = "", looper = "", hoverLoop = "", tiny = "", ringed = "", calm = "";
beforeEach(() => {
  const b = new DocBuilder();
  flasher = b.layer("container", "Strobe", null, { "appearance.opacity": 1 });
  b.clip(flasher, { name: "Strobe", type: "loop", trigger: "mount", duration: 1, easing: "linear", repeat: -1, tracks: [track("appearance.opacity", [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], 1)] });
  looper = b.layer("container", "Spinner", null, { "transform.rotate": 0 });
  b.clip(looper, { name: "Spin", type: "loop", trigger: "mount", duration: 2, easing: "linear", repeat: -1, tracks: [track("transform.rotate", [0, 360], 2)] });
  hoverLoop = b.layer("container", "Wiggle", null, { "transform.rotate": 0 });
  b.clip(hoverLoop, { name: "Wiggle", type: "loop", trigger: "hover", duration: 2, easing: "linear", repeat: -1, tracks: [track("transform.rotate", [0, 10], 2)] });
  tiny = b.layer("container", "Tiny link", null, { "frame.width": 30, "frame.height": 30 });
  b.state(tiny, "hover", { "appearance.opacity": 0.5 });
  ringed = b.layer("button", "Buy", null, { "frame.width": 120, "frame.height": 48 });
  b.state(ringed, "hover", { "appearance.opacity": 0.8 });
  calm = b.layer("container", "Calm", null, { "frame.width": 10, "frame.height": 10 });
  b.clip(calm, { name: "Fade", type: "entrance", trigger: "mount", duration: 0.5, easing: "linear", tracks: [track("appearance.opacity", [0, 1], 0.5)] });
  setDocument(b.build());
  offs = [registerMotionSafetyCommands(), registerStateCommands()];
});
afterEach(() => offs.forEach((o) => o()));
const of = (rule: string, id?: string) => motionSafety(getDocument(), id).filter((f) => f.rule === rule);

describe("Phase 93: flashing", () => {
  it("a loop that flashes more than 3 times a second is an error with a fix", () => {
    const f = of("flash");
    assert.equal(f.length, 1);
    assert.equal(f[0].layerId, flasher);
    assert.equal(f[0].severity, "error");
    assert.match(f[0].message, /times a second/);
  });
  it("the fix slows it to under the limit and undo puts it back", () => {
    const clip = Object.values(getDocument().clips).find((c) => c.layerId === flasher)!;
    assert.equal(exceedsFlashLimit(clip), true);
    assert.equal(run("motionSafety.slowFlashing", { clipId: clip.id }).ok, true);
    const after = getDocument().clips[clip.id];
    assert.equal(exceedsFlashLimit(after), false);
    assert.ok(after.duration > 1);
    assert.equal(of("flash").length, 0);
    historyCommands.undo();
    assert.equal(getDocument().clips[clip.id].duration, 1);
  });
  it("a gentle fade is not flashing", () => {
    assert.equal(of("flash", calm).length, 0);
  });
});

describe("Phase 93: loops that can't be paused", () => {
  it("runs on its own forever, or for more than 5 s", () => {
    const f = of("long-loop");
    assert.deepEqual(f.map((x) => x.layerId).sort(), [flasher, looper].sort());
    const spin = Object.values(getDocument().clips).find((c) => c.layerId === looper)!;
    assert.equal(runTimeOf(spin), Number.POSITIVE_INFINITY);
    assert.equal(runTimeOf({ ...spin, repeat: 2, type: "entrance" }), 6);
    assert.equal(runTimeOf({ ...spin, repeat: 1, type: "entrance" }), 4);
    assert.equal(PAUSE_AFTER_SECONDS, 5);
  });
  it("one the visitor starts (hover) is not on its own", () => {
    assert.equal(of("long-loop", hoverLoop).length, 0);
  });
  it("marking it pausable or essential clears it, and undo brings it back", () => {
    assert.equal(run("layer.setMotionSafety", { ids: [looper], pausable: true }).changed, 1);
    assert.equal(of("long-loop", looper).length, 0);
    historyCommands.undo();
    assert.equal(of("long-loop", looper).length, 1);
    run("layer.setMotionSafety", { ids: [looper], essential: true });
    assert.equal(of("long-loop", looper).length, 0);
    run("layer.setMotionSafety", { ids: [looper], essential: false });
    assert.equal(getDocument().layers[looper].properties["motion.essential"], undefined, "off is not stored");
  });
  it("a layer's fix is what the list offers", () => {
    const fix = of("long-loop", looper)[0].fix!;
    assert.equal(run(fix.command, fix.args).ok, true);
    assert.equal(of("long-loop", looper).length, 0);
  });
});

describe("Phase 93: tap targets and focus", () => {
  it("something to tap under 44 px is flagged; the same layer without a way to tap is not", () => {
    assert.deepEqual(of("touch-target").map((f) => f.layerId), [tiny]);
    assert.equal(of("touch-target", calm).length, 0, "10 px but not something to tap");
    assert.equal(of("touch-target", ringed).length, 0, "120 × 48 is big enough");
  });
  it("the fix makes it 44 px and keeps what was already bigger", () => {
    const fix = of("touch-target", tiny)[0].fix!;
    assert.equal(run(fix.command, fix.args).changed, 1);
    const p = getDocument().layers[tiny].properties;
    assert.equal(p["frame.width"], 44);
    assert.equal(p["frame.height"], 44);
    assert.equal(of("touch-target", tiny).length, 0);
    run("motionSafety.growToTouchTarget", { ids: [ringed] });
    assert.equal(getDocument().layers[ringed].properties["frame.width"], 120);
    historyCommands.undo();
  });
  it("focus: a button has its ring; a link-like layer with no focus state is flagged until it has one", () => {
    assert.equal(of("focus", ringed).length, 0);
    assert.equal(of("focus", tiny).length, 1);
    const fix = of("focus", tiny)[0].fix!;
    assert.equal(run(fix.command, { ...fix.args, edit: false }).ok, true);
    assert.equal(of("focus", tiny).length, 0);
  });
  it("a button whose ring was turned off is flagged", () => {
    run("layer.setMotionSafety", { ids: [ringed] });
    getDocument();
    const b = new DocBuilder();
    const l = b.layer("button", "Bare", null, { "button.focusRingWidth": 0, "frame.width": 100, "frame.height": 50 });
    b.state(l, "hover", { "appearance.opacity": 0.5 });
    setDocument(b.build());
    assert.equal(of("focus").length, 1);
  });
});

describe("Phase 93: the list", () => {
  it("is the same every time and counts by rule", () => {
    const a = motionSafety(getDocument());
    assert.deepEqual(motionSafety(getDocument()), a);
    assert.deepEqual(safetySummary(a), { flash: 1, "long-loop": 2, "touch-target": 1, focus: 1 });
  });
  it("a layer asked about alone only gets its own", () => {
    assert.ok(motionSafety(getDocument(), looper).every((f) => f.layerId === looper));
    assert.deepEqual(motionSafety(getDocument(), "nope"), []);
  });
});
