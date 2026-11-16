import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDocumentFromLayers, createLayer } from "@/core/document/factories";
import { rules } from "@/core/rules";
import { getDocument } from "@/core/store/documentState";
import { documentCommands, historyCommands } from "@/core/store/useDocumentStore";
import { useGhostDiffStore } from "../ghostDiffStore";
import {
  OfflineDeterministicProvider,
  executeValidatedLlmTurn,
  matchLibraryEffects,
  planBuilderTurn,
  type LlmChatRequest,
} from "../index";

function makeBaseDoc() {
  const hero = createLayer({ id: "layer-hero", name: "HeroCard", archetype: "container" });
  const btn = createLayer({ id: "layer-cta", name: "PrimaryButton", archetype: "button" });
  return createDocumentFromLayers([hero, btn]);
}

function buildContext(doc = makeBaseDoc()) {
  const layers = Object.values(doc.layers).map((l) => ({
    id: l.id,
    name: l.name,
    type: l.archetype,
    parentId: l.parentId,
    childCount: l.children.length,
    propsSample: l.properties,
  }));
  return {
    documentName: "Phase243 Studio",
    activeMode: "motion" as const,
    layerCount: layers.length,
    clipCount: Object.keys(doc.clips).length,
    selectedIds: ["layer-cta"],
    layers,
  };
}

describe("Phase 243 · AI builder: planner, library effects, ghost diff & engine summary", () => {
  it("prefers curated library effects when they fit and reports engine choices", () => {
    const matches = matchLibraryEffects("Add magnetic pull hover effect on the CTA button");
    assert.ok(matches.length > 0, "Expected curated magnetic effect match");
    assert.equal(matches[0].id, "w2_magnetic_pull");

    const doc = makeBaseDoc();
    const plan = planBuilderTurn({
      prompt: "Add magnetic pull hover effect on the CTA button",
      documentContext: buildContext(doc),
    });

    assert.ok(plan.matchedEffects.length === 1);
    assert.equal(plan.matchedEffects[0].mdmEffectId, "fx_w2_magnetic_pull");
    assert.ok(plan.engineChoices.some((c) => c.backend === "css"));
    assert.ok(plan.explanation.includes("CSS"));
    assert.ok(plan.explanation.includes("Magnetic Pull"));
  });

  it("supports follow-up turns such as adjusting speed", () => {
    const doc = makeBaseDoc();
    const plan = planBuilderTurn({
      prompt: "Make it faster",
      documentContext: buildContext(doc),
      messages: [
        { role: "user", content: "Add hover scale effect on PrimaryButton" },
        { role: "assistant", content: "Proposed hover clip." },
        { role: "user", content: "Make it faster" },
      ],
    });

    const clipPatch = plan.patches.find((p) => p.path.startsWith("/clips/"));
    assert.ok(clipPatch && typeof clipPatch.value === "object" && clipPatch.value !== null);
    assert.equal((clipPatch.value as { duration: number }).duration, 0.3);
  });

  it("stages ghost diffs, supports per-layer accept/discard and undoable acceptAll", async () => {
    const base = makeBaseDoc();
    documentCommands.replaceDocument(base, "Reset Phase 243 test doc");
    useGhostDiffStore.getState().discardAll();

    const provider = new OfflineDeterministicProvider();
    const request: LlmChatRequest = {
      provider: "offline",
      messages: [{ role: "user", content: "Add spotlight hover effect on the button" }],
      documentContext: buildContext(base),
    };

    const result = await executeValidatedLlmTurn({
      baseDocument: base,
      provider,
      request,
      validateRules: rules.validate,
    });
    assert.equal(result.accepted, true);
    assert.ok(result.patches && result.candidateDocument);

    // Stage without mutating active documentStore
    useGhostDiffStore.getState().stageProposal({
      proposalId: "prop_243_1",
      prompt: "Add spotlight hover effect on the button",
      summary: "Spotlight + hover motion",
      patches: result.patches,
      candidateDocument: result.candidateDocument,
    });

    assert.equal(Object.keys(getDocument().clips).length, 0, "Staging must not mutate active store");
    const pending = useGhostDiffStore.getState().pending;
    assert.ok(pending && pending.layerDiffs["layer-cta"]);

    // Accept per-layer cleanly
    const layerAccepted = useGhostDiffStore.getState().acceptLayer("layer-cta");
    assert.equal(layerAccepted, true);
    assert.equal(Object.keys(getDocument().clips).length, 1);
    assert.ok(Object.keys(getDocument().effects).length >= 1);
    assert.equal(useGhostDiffStore.getState().pending, null);

    // Undo reverts cleanly in 1 step
    assert.equal(historyCommands.undo(), true);
    assert.equal(Object.keys(getDocument().clips).length, 0);
  });

  it("Phase 243 Done gate: one-sentence eval prompts produce accepted results well under 20s p90", async () => {
    const base = makeBaseDoc();
    const provider = new OfflineDeterministicProvider();
    const evalPrompts = [
      "Fade in the hero card on mount",
      "Add magnetic pull hover animation on the button",
      "Add a spotlight hover glow on PrimaryButton",
      "Bounce the button on press click",
      "Reveal HeroCard on scroll",
      "Create a new hero banner section",
      "Add a tactile press spring effect on PrimaryButton",
      "Float the hero card in a gentle loop",
      "Set opacity of HeroCard to 0.9",
      "Round the corners of HeroCard",
    ];

    const latenciesMs: number[] = [];
    for (const prompt of evalPrompts) {
      const start = performance.now();
      const outcome = await executeValidatedLlmTurn({
        baseDocument: base,
        provider,
        request: {
          provider: "offline",
          messages: [{ role: "user", content: prompt }],
          documentContext: buildContext(base),
        },
        validateRules: rules.validate,
      });
      latenciesMs.push(performance.now() - start);
      assert.equal(outcome.accepted, true, `Eval prompt failed: ${prompt} (${outcome.rejectionReason})`);
      assert.ok(outcome.patches && outcome.patches.length > 0);
    }

    latenciesMs.sort((a, b) => a - b);
    const p90 = latenciesMs[Math.floor(latenciesMs.length * 0.9) - 1] ?? latenciesMs[latenciesMs.length - 1];
    assert.ok(p90 < 20_000, `Expected p90 latency < 20,000ms, got ${p90.toFixed(2)}ms`);
  });
});
