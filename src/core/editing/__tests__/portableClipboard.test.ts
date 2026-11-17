import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDocumentFromLayers, createLayer } from "../../document/factories";
import { validateMotionDocument, type Layer } from "../../document/schema";
import { documentCommands, getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useSelectionStore } from "../../store/useSelectionStore";
import { useCanvasViewStore } from "../../store/useCanvasViewStore";
import { copyText, pasteText, resetDuplicateMemory } from "../editOps";
import { CLIP_MARK, parseClip } from "../clipboard";

function makeBlankWindowDoc() {
  return createDocumentFromLayers([
    createLayer({
      id: "win2_frame",
      archetype: "container",
      parentId: null,
      name: "Blank Window",
      children: [],
      properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1280, "frame.height": 800 },
    }) as Layer,
  ]);
}

describe("portable cross-window and Markdown clipboard copy/paste", () => {
  beforeEach(() => {
    const hash = "a".repeat(64);
    const base = createDocumentFromLayers([
      createLayer({
        id: "home",
        archetype: "container",
        parentId: null,
        name: "Home",
        children: ["card", "badge"],
        properties: { "frame.x": 0, "frame.y": 0, "frame.width": 1440, "frame.height": 900 },
      }) as Layer,
      {
        ...(createLayer({
          id: "card",
          archetype: "container",
          parentId: "home",
          name: "Animated Card",
          children: ["btn", "photo", "fx_layer"],
          properties: {
            positioning: "absolute",
            "frame.x": 120,
            "frame.y": 80,
            "frame.width": 320,
            "frame.height": 200,
            "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 12, blur: 24, spread: 0, color: "#00000040" }]),
            "paint.effects": JSON.stringify([{ type: "noise", mode: "mono", grain: "fine", density: 0.2, color: "#ffffff", visible: true }]),
            "filter.blur": 4,
          },
        }) as Layer),
        tokens: { "appearance.background.color": { variable: "var_surface" } },
        styleRefs: { effect: "style_elevated" },
      },
      {
        ...(createLayer({
          id: "btn",
          archetype: "rectangle",
          parentId: "card",
          name: "Magnetic CTA",
          children: [],
          properties: {
            positioning: "absolute",
            "frame.x": 24,
            "frame.y": 120,
            "frame.width": 160,
            "frame.height": 48,
            "shape.cornerRadius": 16,
            "paint.fills": JSON.stringify([{ type: "solid", color: "#4f46e5" }]),
            "paint.effects": JSON.stringify([{ type: "glass", lightAngle: 45, lightIntensity: 0.8, refraction: 0.5, depth: 8, dispersion: 0.2, frost: 6, splay: 0.3, visible: true }]),
          },
        }) as Layer),
        parentRef: "card",
      },
      createLayer({
        id: "photo",
        archetype: "image",
        parentId: "card",
        name: "Hero Image",
        children: [],
        properties: {
          positioning: "absolute",
          "frame.x": 200,
          "frame.y": 16,
          "frame.width": 96,
          "frame.height": 96,
          "media.src": `asset:${hash}`,
        },
      }) as Layer,
      createLayer({
        id: "fx_layer",
        archetype: "effectSurface",
        parentId: "card",
        name: "Shader Backdrop",
        children: [],
        properties: { positioning: "absolute", "frame.x": 0, "frame.y": 0, "frame.width": 320, "frame.height": 200 },
      }) as Layer,
      createLayer({
        id: "badge",
        archetype: "rectangle",
        parentId: "home",
        name: "Sibling Badge",
        children: [],
        properties: { positioning: "absolute", "frame.x": 500, "frame.y": 80, "frame.width": 40, "frame.height": 40 },
      }) as Layer,
    ]);

    base.assets = {
      [hash]: { id: hash, name: "hero.png", kind: "image", mime: "image/png", bytes: 1024, width: 96, height: 96, addedAt: 1000 },
    };
    base.variables = {
      var_surface: { id: "var_surface", name: "Surface", type: "color", values: { light: "#18181b" } },
      var_unused: { id: "var_unused", name: "Unused", type: "color", values: { light: "#ffffff" } },
    };
    base.styles = {
      style_elevated: {
        id: "style_elevated",
        name: "Elevated",
        kind: "effect",
        props: { "paint.shadows": JSON.stringify([{ kind: "drop", x: 0, y: 12, blur: 24, spread: 0, color: "#00000040" }]) },
        bound: { "appearance.background.color": "var_surface" },
      },
    };
    base.clips.clip_cta = {
      id: "clip_cta",
      layerId: "btn",
      name: "Bounce In",
      type: "entrance",
      trigger: "mount",
      delay: 0.1,
      duration: 0.6,
      easing: "spring(bounce: 0.35, time: 0.6)",
      repeat: -1,
      direction: "alternate",
      enabled: true,
      tracks: [
        {
          id: "tr_scale",
          property: "transform.scale",
          keyframes: [
            { id: "kf1", time: 0, value: 0.85, ease: "power2.out" },
            { id: "kf2", time: 0.6, value: 1 },
          ],
        },
      ],
    };
    base.sequences.seq_cta = {
      id: "seq_cta",
      name: "Card Sequence",
      items: [{ id: "it1", clipId: "clip_cta", offset: 0 }],
    };
    base.states.st_rest = { id: "st_rest", layerId: "btn", name: "rest", props: { "transform.scale": 1 } };
    base.states.st_hover = { id: "st_hover", layerId: "btn", name: "hover", props: { "transform.scale": 1.08 } };
    base.transitions.tr_hover = {
      id: "tr_hover",
      layerId: "btn",
      from: "st_rest",
      to: "st_hover",
      trigger: "hover",
      motion: { type: "spring", spring: { bounce: 0.25, time: 0.35 } },
    };
    base.behaviours.beh_spring = {
      id: "beh_spring",
      layerId: "btn",
      type: "spring-to",
      enabled: true,
      params: { property: "transform.x", value: 24, spring: { bounce: 0.3, time: 0.4 } },
    };
    base.surfaces.surf_card = {
      id: "surf_card",
      layerId: "fx_layer",
      role: "inline",
      program: { kind: "css", ref: "gradient-glow" },
      fallback: ["css:gradient-glow", "poster"],
      cost: { tier: "T1" },
      policies: { touch: "static", reducedMotion: { mode: "freeze", at: 0 } },
      poster: { at: 0 },
    };
    base.effects.fx_card = {
      id: "fx_card",
      layerId: "card",
      effectId: "fx_magnetic_card",
      version: "1.0.0",
      seed: 42,
      propOverrides: { strength: 0.4 },
      bindingOverrides: {},
    };
    base.bindings.bind_follow = {
      id: "bind_follow",
      ownerLayerId: "btn",
      enabled: true,
      expr: { signal: { kind: "proximity", layer: "card" }, operators: [] },
      target: { kind: "property", on: { kind: "layer", ref: "btn" }, path: "transform.y" },
    };
    base.graphs.graph_card = {
      id: "graph_card",
      name: "Card Hover Graph",
      ownerLayerId: "card",
      variables: [],
      customEvents: [],
      nodes: [{ id: "n1", kind: "event", type: "Click", params: { target: "btn" }, pins: [{ id: "out", kind: "exec", direction: "out" }] }],
      wires: [],
    };

    setDocument(base);
    resetDuplicateMemory();
    useSelectionStore.getState().clearSelection();
    useCanvasViewStore.setState({ activeFrameId: null });
  });

  it("transfers full design, effects, clips, states, behaviours, transitions, bindings, graphs, styles, variables & assets into a fresh window", () => {
    const copied = copyText(["card"]);
    assert.ok(copied);
    assert.ok(copied.startsWith(CLIP_MARK));

    // Switch to an unrelated blank window document
    setDocument(makeBlankWindowDoc());
    const pastedIds = pasteText(copied);
    assert.equal(pastedIds.length, 1);

    const newCardId = pastedIds[0];
    const targetDoc = getDocument();
    const valid = validateMotionDocument(targetDoc);
    assert.equal(valid.ok, true, valid.ok ? undefined : JSON.stringify(valid.issues));

    const newCard = targetDoc.layers[newCardId];
    assert.equal(newCard.parentId, "win2_frame");
    assert.equal(newCard.properties["filter.blur"], 4);
    assert.ok(typeof newCard.properties["paint.effects"] === "string" && newCard.properties["paint.effects"].includes("noise"));
    assert.ok(typeof newCard.properties["paint.shadows"] === "string" && newCard.properties["paint.shadows"].includes("#00000040"));

    const newBtn = Object.values(targetDoc.layers).find((l) => l.name === "Magnetic CTA")!;
    assert.equal(newBtn.parentId, newCardId);
    assert.equal(newBtn.parentRef, newCardId);
    assert.equal(newBtn.properties["shape.cornerRadius"], 16);
    assert.ok(typeof newBtn.properties["paint.effects"] === "string" && newBtn.properties["paint.effects"].includes("glass"));

    // Animation clip & sequence arrived and target the new button id
    const clips = Object.values(targetDoc.clips).filter((c) => c.layerId === newBtn.id);
    assert.equal(clips.length, 1);
    assert.equal(clips[0].name, "Bounce In");
    assert.equal(clips[0].repeat, -1);
    assert.equal(clips[0].easing, "spring(bounce: 0.35, time: 0.6)");
    assert.equal(clips[0].tracks[0].keyframes.length, 2);

    const seqs = Object.values(targetDoc.sequences);
    assert.equal(seqs.length, 1);
    assert.equal(seqs[0].items[0].clipId, clips[0].id);

    // States & remapped transition
    const states = Object.values(targetDoc.states).filter((s) => s.layerId === newBtn.id);
    assert.equal(states.length, 2);
    const transitions = Object.values(targetDoc.transitions).filter((t) => t.layerId === newBtn.id);
    assert.equal(transitions.length, 1);
    assert.ok(states.some((s) => s.id === transitions[0].from));
    assert.ok(states.some((s) => s.id === transitions[0].to));

    // Behaviours, surfaces, effect instances, bindings, graphs, tokens, styles, assets
    assert.equal(Object.values(targetDoc.behaviours).filter((b) => b.layerId === newBtn.id).length, 1);
    const newFxLayer = Object.values(targetDoc.layers).find((l) => l.name === "Shader Backdrop")!;
    assert.equal(Object.values(targetDoc.surfaces).filter((s) => s.layerId === newFxLayer.id).length, 1);
    assert.equal(Object.values(targetDoc.effects).filter((e) => e.layerId === newCardId).length, 1);

    const bindings = Object.values(targetDoc.bindings).filter((b) => b.ownerLayerId === newBtn.id);
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].expr.signal.kind, "proximity");
    if (bindings[0].expr.signal.kind === "proximity") {
      assert.equal(bindings[0].expr.signal.layer, newCardId);
    }
    assert.ok("on" in bindings[0].target && bindings[0].target.on.kind === "layer" && bindings[0].target.on.ref === newBtn.id);

    const graphs = Object.values(targetDoc.graphs).filter((g) => g.ownerLayerId === newCardId);
    assert.equal(graphs.length, 1);
    assert.equal(graphs[0].nodes[0].params.target, newBtn.id);

    assert.ok(targetDoc.variables?.var_surface);
    assert.equal(targetDoc.variables?.var_unused, undefined);
    assert.ok(targetDoc.styles?.style_elevated);
    assert.ok(targetDoc.assets?.["a".repeat(64)]);

    // One undo removes the pasted subtree and all its dependents cleanly
    historyCommands.undo();
    assert.equal(Object.keys(getDocument().layers).length, 1);
    assert.equal(Object.keys(getDocument().clips).length, 0);
    assert.equal(Object.keys(getDocument().bindings).length, 0);
    assert.equal(Object.keys(getDocument().effects).length, 0);
  });

  it("parses and pastes designs saved inside Markdown (.md) and plain text (.txt) files", () => {
    const copied = copyText(["card"])!;
    const rawJson = copied.slice(CLIP_MARK.length + 1);
    const prettyJson = JSON.stringify(JSON.parse(rawJson), null, 2);

    const markdownVariants = [
      // Saved in a .txt file with CRLF & notes around it
      `Saved design snippet\r\n\r\n${copied}\r\n\r\nEnd of file\r\n`,
      // Saved in a Markdown fenced code block with headings and prose
      `# Hero Card Design\n\nCopy this block back into LazyLayout:\n\n\`\`\`lazylayout\n${copied}\n\`\`\`\n\nNotes: magnetic CTA inside.\n`,
      // Pretty-printed JSON inside a Markdown ```json fence with header marker
      `## Card\n\n\`\`\`json\n${CLIP_MARK}\n${prettyJson}\n\`\`\`\n`,
      // Stripped header line inside a Markdown ```json fence (only JSON body copied)
      `\`\`\`json\n${prettyJson}\n\`\`\`\n`,
    ];

    for (const snippet of markdownVariants) {
      assert.ok(parseClip(snippet) !== null, "Markdown/txt variant should parse cleanly");
      setDocument(makeBlankWindowDoc());
      const ids = pasteText(snippet);
      assert.equal(ids.length, 1);
      const valid = validateMotionDocument(getDocument());
      assert.equal(valid.ok, true, valid.ok ? undefined : JSON.stringify(valid.issues));
      assert.equal(Object.values(getDocument().clips).length, 1);
      assert.equal(Object.values(getDocument().effects).length, 1);
      assert.equal(Object.values(getDocument().bindings).length, 1);
    }
  });

  it("clears missing cross-window external parentRef instead of leaving dangling references", () => {
    // Copy only btn while its parentRef points to "card", then paste into blank doc without "card"
    const copied = copyText(["btn"])!;
    setDocument(makeBlankWindowDoc());
    const [pastedBtnId] = pasteText(copied);
    const targetDoc = getDocument();
    assert.equal(targetDoc.layers[pastedBtnId].parentRef, null);
    // The proximity binding referenced external "card" (not copied), so it is safely omitted rather than leaving a broken ref
    const valid = validateMotionDocument(targetDoc);
    assert.equal(valid.ok, true, valid.ok ? undefined : JSON.stringify(valid.issues));
  });

  it("ignores normal Markdown text and non-LazyLayout JSON fences", () => {
    for (const nonDesign of [
      "# Hello World\n\n```json\n{\"hello\": \"world\"}\n```",
      `Here is the marker ${CLIP_MARK} mentioned inline without a payload.`,
      "```lazylayout\nnot valid json\n```",
    ]) {
      assert.equal(parseClip(nonDesign), null);
    }
    assert.equal(documentCommands !== undefined, true);
  });
});
