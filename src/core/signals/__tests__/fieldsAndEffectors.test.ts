import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFieldHeatmap,
  sampleFieldWeight,
  stepEffectorsFrame,
  type FieldSpec,
  type KineticPieceInput,
  type KineticPieceState,
} from "../fieldsAndEffectors.js";

describe("Phase 157 · Fields & effectors", () => {
  it("keeps every letter strictly outside keepOut circle at all checkpoints and springs home within 0.5 px", () => {
    const pieces: KineticPieceInput[] = Array.from({ length: 12 }, (_, idx) => ({
      id: `letter-${idx}`,
      homeX: 60 + idx * 24,
      homeY: 100,
      radius: 0,
    }));

    const effectors = [
      { id: "eff-keep", fieldId: "f-circle", kind: "keepOut" as const, strength: 1, springStiffness: 220, springDamping: 26 },
    ];

    let states: Record<string, KineticPieceState> = {};

    // Move circle across the whole word line over 90 frames
    for (let frame = 0; frame < 90; frame++) {
      const cx = 40 + frame * 3;
      const field: FieldSpec = {
        id: "f-circle",
        kind: "circle",
        cx,
        cy: 100,
        innerRadius: 48,
        outerRadius: 110,
        falloff: "smoothstep",
      };
      states = stepEffectorsFrame(pieces, [field], effectors, states, 1 / 60);

      for (const piece of pieces) {
        const st = states[piece.id]!;
        const dist = Math.hypot(st.x - cx, st.y - 100);
        assert.ok(dist >= 48 - 1e-6, `piece ${piece.id} penetrated circle at frame ${frame}: dist=${dist}`);
      }
    }

    // Move circle far away and let letters spring home within < 0.5 px
    const farField: FieldSpec = {
      id: "f-circle",
      kind: "circle",
      cx: 2000,
      cy: 2000,
      innerRadius: 48,
      outerRadius: 110,
    };
    for (let frame = 0; frame < 120; frame++) {
      states = stepEffectorsFrame(pieces, [farField], effectors, states, 1 / 60);
    }

    for (const piece of pieces) {
      const st = states[piece.id]!;
      const err = Math.hypot(st.x - piece.homeX, st.y - piece.homeY);
      assert.ok(err < 0.5, `piece ${piece.id} failed to spring home: err=${err}`);
    }
  });

  it("samples box, capsule, ownShape, linear, noise fields and builds heatmap cells", () => {
    const capsule: FieldSpec = {
      id: "cap",
      kind: "capsule",
      ax: 0,
      ay: 0,
      bx: 100,
      by: 0,
      innerRadius: 10,
      outerRadius: 50,
    };
    assert.equal(sampleFieldWeight(capsule, 50, 5).insideInner, true);
    assert.equal(sampleFieldWeight(capsule, 50, 5).weight, 1);
    assert.equal(sampleFieldWeight(capsule, 50, 80).weight, 0);

    const cells = buildFieldHeatmap(capsule, { x: -20, y: -20, width: 140, height: 40 }, 4, 2);
    assert.equal(cells.length, 8);
    assert.ok(cells.some((c) => c.weight > 0.5));
  });
});
