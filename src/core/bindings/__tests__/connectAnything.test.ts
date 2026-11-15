import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BindingDraftSchema } from "../../document/signals";
import { connectPropertyToSource } from "../connectAnything";

describe("Stage 4 Phase 141: Connect anything gesture compiler", () => {
  it("connects rotation to cursor with gentle feel and human-readable sentence", () => {
    const res = connectPropertyToSource({
      targetLayerId: "card",
      targetPath: "transform.rotate",
      targetLabel: "Rotation",
      source: { kind: "cursor", axis: "x" },
      feel: "gentle",
    });
    assert.equal(res.mode, "binding");
    if (res.mode !== "binding") throw new Error("Expected binding");
    assert.equal(res.sentence, "Rotation follows the cursor across, gently");
    assert.equal(BindingDraftSchema.safeParse(res.draft).success, true);
    assert.equal(res.draft.expr.signal.kind, "pointerIn");
  });

  it("connects opacity to scroll and scale to microphone across three distinct input types", () => {
    const scrollRes = connectPropertyToSource({
      targetLayerId: "card",
      targetPath: "appearance.opacity",
      source: { kind: "scroll" },
      feel: "snappy",
    });
    const keyRes = connectPropertyToSource({
      targetLayerId: "card",
      targetPath: "transform.x",
      source: { kind: "key", axis: "x" },
      feel: "bouncy",
    });
    const micRes = connectPropertyToSource({
      targetLayerId: "card",
      targetPath: "transform.scale",
      source: { kind: "microphone", band: 2 },
      feel: "direct",
    });

    for (const r of [scrollRes, keyRes, micRes]) {
      assert.equal(r.mode, "binding");
      if (r.mode === "binding") {
        assert.equal(BindingDraftSchema.safeParse(r.draft).success, true);
      }
    }
    assert.ok(keyRes.sentence.includes("arrow keys"));
    assert.ok(micRes.sentence.includes("microphone band 2"));
  });

  it("unifies Phase 76 layer-to-layer pick-whip property links", () => {
    const linkRes = connectPropertyToSource({
      targetLayerId: "follower",
      targetPath: "transform.y",
      source: {
        kind: "layerProp",
        sourceLayerId: "leader",
        sourceLayerName: "Leader",
        sourceProperty: "transform.x",
      },
      feel: "gentle",
    });
    assert.equal(linkRes.mode, "property-link");
    if (linkRes.mode !== "property-link") throw new Error("Expected property-link");
    assert.equal(linkRes.linkSlot.sourceLayerId, "leader");
    assert.equal(linkRes.linkSlot.sourceProperty, "transform.x");
    assert.equal(linkRes.linkSlot.targetPath, "transform.y");
  });
});
