import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { setDocument, getDocument } from "../../store/documentState";
import { historyCommands } from "../../store/useDocumentStore";
import { tryRunCommand } from "../../commands";
import { evaluate } from "../../kernel/evaluate";
import { isMovement } from "../../breakpoints/breakpointMotion";
import { textFxOf, textFxText } from "../../text/textFx";
import { ALL_PRESETS } from "../../motion/presets";
import { listEffects, getEffect, whyNotOn } from "../library";
import { TEXT_EFFECTS } from "../textEffects";
import { clipIdOf, registerLibraryCommands } from "../libraryCommands";

/** ROADMAP Phase 92 (wave 1, text): recipes over the text motion properties, and a sweep over the whole library. */
const run = (id: string, args: Record<string, unknown>) => (tryRunCommand(id, args) as { result?: { ok?: boolean; message?: string; instances?: string[] } }).result ?? {};
let off: () => void;
beforeEach(() => { off = registerLibraryCommands(); });
afterEach(() => off());

const textDoc = (content: string) => {
  const b = new DocBuilder();
  const layer = b.layer("text", "Words", null, { "content.text": content });
  setDocument(b.build());
  return { layer, comp: Object.keys(getDocument().compositions)[0] };
};
const shown = (layer: string, comp: string, t: number, content: string) => {
  const r = evaluate(getDocument(), comp, layer, t);
  const read = (p: string) => (r[p] !== undefined ? r[p] : getDocument().layers[layer].properties[p]);
  const fx = textFxOf(read, typeof r["text.fxProgress"] === "number" ? (r["text.fxProgress"] as number) : undefined);
  return fx ? textFxText(content, fx) : content;
};

describe("Phase 92: the wave 1 recipes", () => {
  it("are original, named once, text-only, and none repeats a preset already in the catalogue", () => {
    assert.equal(TEXT_EFFECTS.length, 5);
    assert.equal(new Set(TEXT_EFFECTS.map((e) => e.id)).size, 5);
    const presetNames = new Set(ALL_PRESETS.map((p) => p.name.toLowerCase()));
    for (const e of TEXT_EFFECTS) {
      assert.equal(e.provenance.original, true);
      assert.ok(e.provenance.recipe.length > 10);
      assert.deepEqual(e.archetypes, ["text"]);
      assert.ok(!presetNames.has(e.name.toLowerCase()), `${e.name} is not a preset's name`);
      assert.ok(getEffect(e.id), "in the library");
    }
  });
  it("Decrypt settles left to right into the text", () => {
    const content = "Hello world";
    const { layer, comp } = textDoc(content);
    const id = run("library.insert", { effectId: "fx_text_decrypt", ids: [layer] }).instances![0];
    assert.equal(getDocument().layers[layer].properties["text.fx"], "scramble");
    const dur = getDocument().clips[clipIdOf(id)].duration;
    const start = shown(layer, comp, 0, content);
    assert.equal(start.length, content.length);
    assert.notEqual(start, content);
    assert.equal(shown(layer, comp, dur, content), content, "at the end it is the text");
    const mid = shown(layer, comp, dur * 0.5, content);
    const settled = [...mid].findIndex((c, i) => c !== content[i]);
    assert.ok(settled === -1 || settled > 0, "the front has settled");
  });
  it("Typed Text types the characters with a caret until it is done", () => {
    const content = "Type me please";
    const { layer, comp } = textDoc(content);
    const id = run("library.insert", { effectId: "fx_text_typed", ids: [layer] }).instances![0];
    const dur = getDocument().clips[clipIdOf(id)].duration;
    assert.equal(shown(layer, comp, 0, content), "▏");
    const half = shown(layer, comp, dur / 2, content);
    assert.ok(half.startsWith(content.slice(0, 5)) && half.endsWith("▏") && half.length < content.length);
    assert.equal(shown(layer, comp, dur, content), content);
  });
  it("Rotating Words shows each word in turn and loops", () => {
    const { layer, comp } = textDoc("Anything");
    const id = run("library.insert", { effectId: "fx_text_rotating_words", ids: [layer] }).instances![0];
    const dur = getDocument().clips[clipIdOf(id)].duration;
    assert.equal(shown(layer, comp, dur * 0.05, "Anything"), "Design");
    assert.equal(shown(layer, comp, dur * 0.5, "Anything"), "Motion");
    assert.equal(shown(layer, comp, dur * 0.95, "Anything"), "Ship");
    assert.equal(getDocument().clips[clipIdOf(id)].repeat, -1);
  });
  it("Count Up needs a number, and counts to it", () => {
    const { layer, comp } = textDoc("No numbers here");
    const e = getEffect("fx_text_count_up")!;
    assert.match(whyNotOn(e, "text", "No numbers here") ?? "", /number/);
    const refused = run("library.insert", { effectId: e.id, ids: [layer] });
    assert.equal(refused.ok, false);
    assert.equal(Object.keys(getDocument().effects).length, 0, "nothing was changed");
    const t2 = textDoc("1,200 happy people");
    const id = run("library.insert", { effectId: e.id, ids: [t2.layer] }).instances![0];
    const dur = getDocument().clips[clipIdOf(id)].duration;
    assert.ok(shown(t2.layer, t2.comp, 0, "1,200 happy people").startsWith("0 "));
    assert.equal(shown(t2.layer, t2.comp, dur, "1,200 happy people"), "1,200 happy people");
    void comp;
  });
  it("Scroll Reveal Text is a scrubbed clip", () => {
    const { layer } = textDoc("Scroll me");
    const id = run("library.insert", { effectId: "fx_text_scroll_reveal", ids: [layer] }).instances![0];
    const clip = getDocument().clips[clipIdOf(id)];
    assert.equal(clip.trigger, "scrollProgress");
    assert.ok(clip.scrollTrigger?.scrub);
  });
  it("undo takes the layer's settings and the clip back; remove clears the settings", () => {
    const { layer } = textDoc("Undo me");
    run("library.insert", { effectId: "fx_text_decrypt", ids: [layer] });
    historyCommands.undo();
    assert.equal(getDocument().layers[layer].properties["text.fx"], undefined);
    const id = run("library.insert", { effectId: "fx_text_typed", ids: [layer] }).instances![0];
    assert.equal(getDocument().layers[layer].properties["text.fxCaret"], true);
    assert.equal(run("library.remove", { instance: id }).ok, true);
    assert.equal(getDocument().layers[layer].properties["text.fx"], undefined);
    assert.equal(getDocument().layers[layer].properties["text.fxCaret"], undefined);
  });
  it("Strength does not scale a progress that goes from 0 to 1", () => {
    const e = getEffect("fx_text_decrypt")!;
    assert.deepEqual(e.props.map((p) => p.key), ["duration", "delay"]);
  });
});

describe("Phase 92: the sweep over every library effect", () => {
  const build = (archetype: string, content: string) => {
    const b = new DocBuilder();
    const layer = b.layer(archetype as never, "Subject", null, { "content.text": content });
    setDocument(b.build());
    return { layer, comp: Object.keys(getDocument().compositions)[0] };
  };
  it("every effect inserts on a layer it is for, evaluates to finite numbers through its whole time, and under reduced motion does not move", () => {
    let swept = 0;
    // "Glitch Chromatic" is a hover effect for text only, and Rule 6.1 says text can't be hovered: it can go nowhere. It is
    // a preset from Sub-Phase 7.3, listed here so that a new effect with the same problem fails this test instead.
    const nowhere = listEffects().filter((e) => !e.archetypes.some((a) => whyNotOn(e, a, "Counts 100 things") === null)).map((e) => e.id);
    assert.deepEqual(nowhere, ["fx_text_glitch_chromatic"]);
    for (const e of listEffects()) {
      const archetype = e.archetypes.find((a) => whyNotOn(e, a, "Counts 100 things") === null);
      if (!archetype) continue;
      const { layer, comp } = build(archetype!, "Counts 100 things");
      const out = run("library.insert", { effectId: e.id, ids: [layer] });
      assert.equal(out.ok, true, `${e.id}: ${out.message}`);
      const clip = Object.values(getDocument().clips).find((c) => c.layerId === layer)!;
      const end = clip.duration + (clip.delay ?? 0);
      for (const f of [0, 0.25, 0.5, 0.75, 1]) {
        const r = evaluate(getDocument(), comp, layer, end * f);
        for (const [k, v] of Object.entries(r)) if (typeof v === "number") assert.ok(Number.isFinite(v), `${e.id} ${k} at ${f}`);
      }
      // reduced motion: what moves in space holds still
      const at = (f: number) => evaluate(getDocument(), comp, layer, end * f, { reducedMotion: true });
      const a = at(0.2), b = at(0.8);
      for (const k of Object.keys(b)) if (isMovement(k)) assert.deepEqual(b[k], a[k], `${e.id}: ${k} still under reduced motion`);
      swept++;
    }
    assert.equal(swept, listEffects().length - 1);
  });
});
