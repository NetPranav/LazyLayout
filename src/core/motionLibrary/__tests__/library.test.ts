import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { historyCommands } from "../../store/useDocumentStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { ALL_PRESETS } from "../../motion/presets";
import { LIBRARY_CATEGORIES, applyProps, thumbnailOf, buildLibrary, droppedPresets, effectIdOf, getEffect, listEffects, overridesOf, propsOf, searchEffects, whyNotOn } from "../library";
import { clipIdOf, instancesOn, registerLibraryCommands, valuesOf } from "../libraryCommands";

/** ROADMAP Phase 91: the 51 presets as a searchable library of versioned effects; insert, tune, detach. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: { ok?: boolean; code?: string; message?: string; instances?: string[] } }).result ?? {};
let off: () => void;
let box = "";
let words = "";
beforeEach(() => {
  const b = new DocBuilder();
  box = b.layer("container", "Box", null, {});
  words = b.layer("text", "Words", null, {});
  setDocument(b.build());
  off = registerLibraryCommands();
});
afterEach(() => off());

describe("Phase 91: the library", () => {
  it("has every preset once, with a stable id, a version, a category and tags", () => {
    const all = listEffects();
    assert.equal(all.length + droppedPresets().length, ALL_PRESETS.length);
    assert.equal(all.length, 51, "the 51 presets migrate; none was a duplicate");
    assert.equal(new Set(all.map((e) => e.id)).size, all.length, "ids are unique");
    for (const e of all) {
      assert.match(e.id, /^fx_[a-z0-9_]+$/);
      assert.match(e.version, /^\d+\.\d+\.\d+$/);
      assert.ok(LIBRARY_CATEGORIES.includes(e.category));
      assert.ok(e.tags.length >= 2);
      assert.ok(e.props.some((p) => p.key === "duration"));
    }
    assert.equal(effectIdOf("preset_text_word_stagger"), "fx_text_word_stagger");
    assert.ok(getEffect("fx_text_word_stagger"));
  });
  it("drops a preset that is the same animation as an earlier one and merges where it can go", () => {
    const first = ALL_PRESETS[0];
    const twin = { ...first, id: "preset_twin", name: "Twin", compatibleArchetypes: ["badge" as const] };
    const lib = buildLibrary([first, twin]);
    assert.equal(lib.effects.length, 1);
    assert.deepEqual(lib.dropped, [{ presetId: "preset_twin", sameAs: first.id }]);
    assert.ok(lib.effects[0].archetypes.includes("badge"));
  });
  it("searches by name, tag and description, best match first", () => {
    const burns = searchEffects({ query: "ken burns" });
    assert.ok(burns.length >= 2);
    assert.ok(burns.every((e) => e.category === "media"));
    const stagger = searchEffects({ query: "stagger" });
    assert.ok(stagger.length > 0);
    assert.equal(stagger[0].name.toLowerCase().includes("stagger") || stagger[0].tags.includes("stagger"), true);
    assert.deepEqual(searchEffects({ query: "zzzz-nothing" }), []);
    assert.equal(searchEffects().length, 51);
    assert.equal(searchEffects({ category: "text" }).length, 12);
    assert.ok(searchEffects({ tag: "spring" }).every((e) => e.tags.includes("spring")));
  });
  it("every word of a query has to match", () => {
    assert.equal(searchEffects({ query: "ken burns zzzz" }).length, 0);
  });
  it("Rule 6.1: text layers are not offered hover or tap effects, and say why", () => {
    const forText = searchEffects({ archetype: "text" });
    assert.ok(forText.length > 0);
    for (const e of forText) assert.equal(whyNotOn(e, "text"), null);
    const hover = listEffects().find((e) => ALL_PRESETS.find((p) => p.id === e.presetId)?.animation.type === "hover")!;
    assert.match(whyNotOn(hover, "text") ?? "", /Rule 6.1/);
    assert.ok(!forText.includes(hover));
  });
});

describe("Phase 91: props", () => {
  const sample = () => ALL_PRESETS.find((p) => (p.animation.tracks ?? []).some((t) => t.keyframes.length >= 2 && typeof t.keyframes[0].value === "number") && p.animation.type === "entrance")!;
  it("every effect has a duration and a delay, and strength when it moves numbers", () => {
    const p = propsOf(sample().animation);
    assert.deepEqual(p.map((x) => x.key).slice(0, 3), ["duration", "delay", "strength"]);
  });
  it("applying the defaults changes nothing", () => {
    const a = sample().animation;
    assert.deepEqual(applyProps(a, {}), a);
    assert.deepEqual(applyProps(a, { duration: a.duration, strength: 100 }), a);
  });
  it("duration scales every key time and stays inside the range", () => {
    const a = sample().animation;
    const out = applyProps(a, { duration: a.duration * 2 });
    assert.equal(out.duration, a.duration * 2);
    const lastBefore = Math.max(...(a.tracks ?? []).flatMap((t) => t.keyframes.map((k) => k.time)));
    const lastAfter = Math.max(...(out.tracks ?? []).flatMap((t) => t.keyframes.map((k) => k.time)));
    assert.ok(Math.abs(lastAfter - lastBefore * 2) < 1e-6);
    assert.equal(applyProps(a, { duration: 999 }).duration, 10);
  });
  it("strength moves values towards or away from rest, and 0 leaves only rest", () => {
    const a = sample().animation;
    const track = (a.tracks ?? []).find((t) => typeof t.keyframes[0].value === "number")!;
    const rest = track.keyframes[track.keyframes.length - 1].value as number;
    const first = track.keyframes[0].value as number;
    const half = applyProps(a, { strength: 50 }).tracks!.find((t) => t.property === track.property)!;
    assert.ok(Math.abs((half.keyframes[0].value as number) - (rest + (first - rest) / 2)) < 1e-6);
    const none = applyProps(a, { strength: 0 }).tracks!.find((t) => t.property === track.property)!;
    assert.equal(none.keyframes[0].value, rest);
  });
  it("only what differs from the defaults is kept as an override", () => {
    const e = listEffects()[0];
    const d = e.props[0].default;
    assert.deepEqual(overridesOf(e, { duration: d }), {});
    assert.deepEqual(overridesOf(e, { duration: d + 1 }), { duration: Math.min(e.props[0].max, d + 1) });
  });
});

describe("Phase 91: thumbnails", () => {
  it("every effect has a pre-rendered loop of plain numbers inside the box, with the same frames every time", () => {
    for (const e of listEffects()) {
      const t = thumbnailOf(e);
      assert.equal(t.frames.length, 13);
      assert.ok(t.duration > 0.5);
      assert.ok(t.poster >= 0 && t.poster < t.frames.length);
      for (const f of t.frames) {
        for (const v of [f.x, f.y, f.scale, f.rotate, f.opacity]) assert.ok(Number.isFinite(v), `${e.id} has a number`);
        assert.ok(Math.abs(f.x) <= 14 && Math.abs(f.y) <= 14, "inside the box");
        assert.ok(f.opacity >= 0 && f.opacity <= 1);
      }
      assert.deepEqual(thumbnailOf(e), t);
    }
  });
  it("a fade-in thumbnail starts invisible and ends visible", () => {
    const e = listEffects().find((x) => ALL_PRESETS.find((p) => p.id === x.presetId)?.animation.tracks?.some((t) => t.property === "appearance.opacity" && (t.keyframes[0].value as number) === 0 && x.category === "text"))!;
    const t = thumbnailOf(e);
    assert.equal(t.frames[0].opacity, 0);
    assert.equal(t.frames[t.frames.length - 1].opacity, 1);
  });
});

describe("Phase 91: insert, tune, detach", () => {
  const fade = () => searchEffects({ archetype: "text" }).find((e) => ALL_PRESETS.find((p) => p.id === e.presetId)?.animation.type === "entrance")!;
  it("insert adds an instance and its clip in one undo step, and the clip plays", () => {
    const e = fade();
    const out = run("library.insert", { effectId: e.id, ids: [words] });
    assert.equal(out.ok, true, out.message);
    const doc = getDocument();
    const inst = Object.values(doc.effects);
    assert.equal(inst.length, 1);
    assert.equal(inst[0].effectId, e.id);
    assert.equal(inst[0].layerId, words);
    assert.ok(doc.clips[clipIdOf(inst[0].id)], "the clip has an id made from the instance's");
    assert.equal(instancesOn(words).length, 1);
    const comp = Object.keys(doc.compositions)[0];
    const clip = doc.clips[clipIdOf(inst[0].id)];
    const t0 = evaluate(doc, comp, words, 0), t1 = evaluate(doc, comp, words, clip.duration + (clip.delay ?? 0) + 0.01);
    assert.notDeepEqual(t0, t1, "the layer moves over the effect's time");
    historyCommands.undo();
    assert.equal(Object.keys(getDocument().effects).length, 0);
    assert.equal(Object.keys(getDocument().clips).length, 0);
  });
  it("refuses an effect a layer can't have, with the reason, and changes nothing", () => {
    const hover = listEffects().find((e) => ALL_PRESETS.find((p) => p.id === e.presetId)?.animation.type === "hover")!;
    const before = JSON.stringify(getDocument());
    const out = run("library.insert", { effectId: hover.id, ids: [words] });
    assert.equal(out.ok, false);
    assert.match(out.message ?? "", /Rule 6.1/);
    assert.equal(JSON.stringify(getDocument()), before);
    assert.equal(run("library.insert", { effectId: "fx_nope", ids: [words] }).code, "NO_EFFECT");
    assert.equal(run("library.insert", { effectId: hover.id, ids: [] }).code, "NO_LAYER");
  });
  it("setProps changes the clip and stores only the differences; undo puts it back", () => {
    const e = fade();
    const id = run("library.insert", { effectId: e.id, ids: [words] }).instances![0];
    const d = e.props[0].default;
    assert.equal(run("library.setProps", { instance: id, values: { duration: d + 1 } }).ok, true);
    assert.equal(getDocument().clips[clipIdOf(id)].duration, Math.min(10, d + 1));
    assert.deepEqual(getDocument().effects[id].propOverrides, { duration: Math.min(10, d + 1) });
    assert.equal(valuesOf(getDocument().effects[id]).duration, Math.min(10, d + 1));
    assert.equal(run("library.setProps", { instance: id, values: { duration: d } }).ok, true);
    assert.deepEqual(getDocument().effects[id].propOverrides, {}, "back at the default stores nothing");
    historyCommands.undo();
    assert.equal(getDocument().clips[clipIdOf(id)].duration, Math.min(10, d + 1));
  });
  it("detach keeps the clip as plain animation and forgets the instance; remove takes both", () => {
    const e = fade();
    const a = run("library.insert", { effectId: e.id, ids: [words] }).instances![0];
    const b = run("library.insert", { effectId: e.id, ids: [words] }).instances![0];
    assert.equal(run("library.detach", { instance: a }).ok, true);
    assert.equal(getDocument().effects[a], undefined);
    assert.ok(getDocument().clips[clipIdOf(a)], "the animation is still there");
    assert.equal(instancesOn(words).length, 1);
    assert.equal(run("library.remove", { instance: b }).ok, true);
    assert.equal(getDocument().clips[clipIdOf(b)], undefined);
    assert.equal(run("library.detach", { instance: "nope" }).code, "NO_INSTANCE");
  });
  it("inserting on several layers makes one instance each in one undo step", () => {
    const e = fade();
    const out = run("library.insert", { effectId: e.id, ids: [words, words] });
    assert.equal(out.instances?.length, 2);
    historyCommands.undo();
    assert.equal(Object.keys(getDocument().effects).length, 0);
  });
});
