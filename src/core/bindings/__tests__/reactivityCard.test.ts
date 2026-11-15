import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingDraftSchema } from "../../document/signals";
import {
  affordancesForLayer,
  buildReactivityDrafts,
  describeReactivity,
  meterProgress,
  REACTIVITY_SOURCES,
  smoothnessToTau,
} from "../reactivityCard";

describe("Stage 4 Phase 140: Simple Reactivity Card builder", () => {
  it("exposes all 6 Simple reactivity sources and filters affordances by layer archetype", () => {
    assert.deepEqual(
      REACTIVITY_SOURCES.map((s) => s.id),
      ["cursor", "scroll", "hover", "touch", "keyboard", "sound"]
    );
    const bgCursor = affordancesForLayer("background", "cursor");
    assert.ok(bgCursor.some((a) => a.id === "follow"));
    assert.ok(!bgCursor.some((a) => a.id === "repel"));
  });

  it("compiles a cursor follow reaction into two validated x/y BindingDrafts in one step", () => {
    const drafts = buildReactivityDrafts({
      ownerLayerId: "bg_main",
      layerName: "Background",
      source: "cursor",
      affordance: "follow",
      strength: 80,
      smoothness: 60,
    });
    assert.equal(drafts.length, 2);
    for (const draft of drafts) {
      assert.equal(BindingDraftSchema.safeParse(draft).success, true);
    }
    assert.equal(drafts[0]!.target.kind, "property");
    assert.equal((drafts[0]!.target as { path: string }).path, "transform.x");
    assert.equal((drafts[1]!.target as { path: string }).path, "transform.y");
  });

  it("formats plain-language reaction sentences and maps smoothness + meters cleanly", () => {
    const sentence = describeReactivity({
      ownerLayerId: "bg_main",
      layerName: "Background",
      source: "cursor",
      affordance: "follow",
      strength: 80,
      smoothness: 75,
    });
    assert.equal(sentence, "Background follows the cursor smoothly at 80% strength.");
    assert.ok(smoothnessToTau(100) > smoothnessToTau(0));
    assert.equal(meterProgress(0.5, 0, 1), 0.5);
    assert.equal(meterProgress(2, 0, 1), 1);
  });
});
