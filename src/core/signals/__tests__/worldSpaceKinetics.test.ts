import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyMatrix2D,
  auditKineticSimpleLabels,
  composeWorldMatrix2D,
  mapKineticSimpleFace,
  stepWorldSpaceKinetics,
} from "../worldSpaceKinetics.js";
import type { KineticPieceInput, KineticPieceState } from "../fieldsAndEffectors.js";

describe("Phase 158 · One evaluation space & no-maths kinetics", () => {
  it("evaluates keepOut accurately inside a rotated and scaled parent card with Stay-inside bounds", () => {
    // Card at (200, 100), rotated 45 deg, scaled 1.5x
    const parentWorld = composeWorldMatrix2D([
      { x: 200, y: 100, rotateDeg: 45, scaleX: 1.5, scaleY: 1.5 },
    ]);

    const localLetter: KineticPieceInput = { id: "ch-0", homeX: 40, homeY: 0, radius: 0 };
    const worldHome = applyMatrix2D(parentWorld, localLetter.homeX, localLetter.homeY);

    // Put circle keep-out centered right on worldHome!
    const mapped = mapKineticSimpleFace(
      { Reach: 120, Gap: 40, Edge: "Soft", Strength: "Strong", Variety: 0.25, Shuffle: 1, "Stay inside": true },
      worldHome.x,
      worldHome.y,
    );

    const field = {
      id: "ring",
      kind: "circle" as const,
      cx: worldHome.x,
      cy: worldHome.y,
      innerRadius: mapped.innerRadius,
      outerRadius: mapped.outerRadius,
      falloff: mapped.falloff,
    };
    const effectors = [{ id: "e1", fieldId: "ring", kind: "keepOut" as const, strength: mapped.strength }];

    let states: Record<string, KineticPieceState> = {};
    let lastResult = stepWorldSpaceKinetics([localLetter], parentWorld, [field], effectors, states, 1 / 60, {
      minX: 150,
      maxX: 350,
      minY: 50,
      maxY: 250,
    });
    states = lastResult.nextStates;
    for (let f = 0; f < 10; f++) {
      lastResult = stepWorldSpaceKinetics([localLetter], parentWorld, [field], effectors, states, 1 / 60, {
        minX: 150,
        maxX: 350,
        minY: 50,
        maxY: 250,
      });
      states = lastResult.nextStates;
    }

    const r = lastResult.results[0]!;
    const worldDist = Math.hypot(r.worldX - worldHome.x, r.worldY - worldHome.y);
    assert.ok(worldDist >= 40 - 1e-6);
    assert.ok(r.worldX >= 150 && r.worldX <= 350);
    assert.ok(r.worldY >= 50 && r.worldY <= 250);
    // Inverse-transform local displacement is non-zero in both axes because parent is rotated 45 deg
    assert.ok(Math.abs(r.localDeltaX) > 1 || Math.abs(r.localDeltaY) > 1);
  });

  it("passes Law 17 label audit and holds 60fps budget across 400 letters", () => {
    const faceLabels = ["Reach", "Gap", "Edge", "Strength", "Variety", "Shuffle", "Stay inside"];
    assert.deepEqual(auditKineticSimpleLabels(faceLabels), []);

    const parentWorld = composeWorldMatrix2D([{ x: 100, y: 100, rotateDeg: 15, scaleX: 1.2, scaleY: 1.2 }]);
    const letters: KineticPieceInput[] = Array.from({ length: 400 }, (_, i) => ({
      id: `l-${i}`,
      homeX: (i % 20) * 20,
      homeY: Math.floor(i / 20) * 20,
    }));
    const fields = [
      { id: "f1", kind: "circle" as const, cx: 250, cy: 250, innerRadius: 30, outerRadius: 120 },
    ];
    const effectors = [{ id: "e1", fieldId: "f1", kind: "push" as const, strength: 1.2 }];

    let states: Record<string, KineticPieceState> = {};
    const t0 = performance.now();
    for (let f = 0; f < 10; f++) {
      const out = stepWorldSpaceKinetics(letters, parentWorld, fields, effectors, states, 1 / 60);
      states = out.nextStates;
    }
    const perFrameMs = (performance.now() - t0) / 10;
    assert.ok(perFrameMs < 16, `400-letter world kinetics exceeded 16ms frame budget: ${perFrameMs.toFixed(2)}ms`);
  });
});
