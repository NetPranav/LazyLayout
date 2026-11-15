import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeLayerRelation,
  inferLayerRole,
  resolveSemanticSelector,
  type SemanticLayerNode,
} from "../rolesAndSelectors.js";

describe("Phase 155 · Roles, relations & selectors", () => {
  const fixtureLayers: SemanticLayerNode[] = [
    { id: "hero-sec", name: "Hero Section", x: 0, y: 0, width: 1200, height: 600, orderIndex: 0 },
    { id: "h1", name: "Headline", archetype: "text", fontSizePx: 48, parentId: "hero-sec", x: 80, y: 80, width: 400, height: 60, orderIndex: 1 },
    { id: "cta-1", name: "Primary CTA Button", parentId: "nav", x: 80, y: 200, width: 120, height: 40, orderIndex: 2 },
    { id: "cta-2", name: "Secondary Button", parentId: "nav", x: 240, y: 200, width: 120, height: 40, orderIndex: 3 },
    { id: "nav-link", name: "Docs Link", parentId: "nav", x: 400, y: 200, width: 80, height: 40, orderIndex: 4 },
    { id: "card-near", name: "Feature Card", parentId: "grid", x: 100, y: 260, width: 160, height: 120, orderIndex: 5 },
    { id: "card-far", name: "Pricing Card", parentId: "grid", x: 700, y: 260, width: 160, height: 120, orderIndex: 6 },
    { id: "hero-img", archetype: "media", name: "Preview", x: 500, y: 80, width: 200, height: 150, orderIndex: 7 },
    { id: "email-in", name: "Email Input", x: 100, y: 420, width: 200, height: 40, orderIndex: 8 },
    { id: "badge-new", name: "New Badge", role: "badge", x: 200, y: 280, width: 50, height: 24, orderIndex: 9 },
  ];

  it("picks the right layers across 10 semantic selector fixtures", () => {
    // 1-4: Role inference checks
    assert.equal(inferLayerRole(fixtureLayers[1]!), "heading");
    assert.equal(inferLayerRole(fixtureLayers[2]!), "button");
    assert.equal(inferLayerRole(fixtureLayers[4]!), "link");
    assert.equal(inferLayerRole(fixtureLayers[9]!), "badge");

    // 5: "every button" (matchesPlural & role inference)
    const buttons = resolveSemanticSelector("every button", fixtureLayers);
    assert.deepEqual(buttons.map((b) => b.id), ["cta-1", "cta-2"]);

    // 6: "every card"
    const cards = resolveSemanticSelector("every card", fixtureLayers);
    assert.deepEqual(cards.map((c) => c.id), ["card-near", "card-far"]);

    // 7: "the nearest card" from cta-1
    const nearest = resolveSemanticSelector("the nearest card", fixtureLayers, { selfId: "cta-1" });
    assert.deepEqual(nearest.map((n) => n.id), ["card-near"]);

    // 8: "my neighbours" from cta-1 (shares parentId "nav")
    const neighbours = resolveSemanticSelector("my neighbours", fixtureLayers, { selfId: "cta-1" });
    assert.deepEqual(neighbours.map((n) => n.id), ["cta-2", "nav-link"]);

    // 9: "the layer under the cursor" (overlapping hero-sec, card-near, and badge-new -> highest orderIndex = badge-new)
    const under = resolveSemanticSelector("the layer under the cursor", fixtureLayers, { pointer: { x: 215, y: 290 } });
    assert.deepEqual(under.map((u) => u.id), ["badge-new"]);

    // 10: explicit id lookup fallback
    const exact = resolveSemanticSelector("email-in", fixtureLayers);
    assert.deepEqual(exact.map((e) => e.id), ["email-in"]);
  });

  it("computes pairwise relation signals (distance, angle, overlap, order)", () => {
    const a: SemanticLayerNode = { id: "a", x: 0, y: 0, width: 100, height: 100, orderIndex: 1 };
    const b: SemanticLayerNode = { id: "b", x: 50, y: 0, width: 100, height: 100, orderIndex: 4 };
    const rel = computeLayerRelation(a, b);
    assert.equal(rel.centerDistancePx, 50);
    assert.equal(rel.edgeDistancePx, 0);
    assert.equal(rel.angleDeg, 0);
    assert.equal(rel.overlapAreaPx, 5000);
    assert.equal(rel.overlapRatioA, 0.5);
    assert.equal(rel.orderDelta, 3);
  });
});
