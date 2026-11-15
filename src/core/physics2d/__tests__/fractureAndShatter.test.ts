import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateFracturePieces,
  stepFracturePieces,
  verifyTilingCoverage,
  type FracturePatternKind,
} from "../fractureAndShatter";

describe("Phase 186: Fracture (shatter, strips & tearing)", () => {
  it("tiles original layer bounds across voronoi, strips, grid, and tear_line with < 0.5 px area delta", () => {
    const kinds: FracturePatternKind[] = ["voronoi", "strips", "grid", "tear_line"];
    for (const kind of kinds) {
      const pieces = generateFracturePieces({
        kind,
        width: 240,
        height: 160,
        seed: 186,
        pieceCount: 14,
        cols: 4,
        rows: 3,
      });
      assert.ok(pieces.length >= 2);
      const coverage = verifyTilingCoverage(pieces, 240, 160);
      assert.equal(
        coverage.exactTiling,
        true,
        `${kind} tiling check failed: delta=${coverage.areaDelta}, gaps=${coverage.zeroGapCount}, maxOverlap=${coverage.maxPointOverlapCount}`
      );
    }
  });

  it("replays fracture deterministically, shatters under gravity, and springs cleanly back home", () => {
    const spec = {
      kind: "voronoi" as const,
      width: 180,
      height: 120,
      seed: 909,
      pieceCount: 10,
      impactX: 90,
      impactY: 60,
      radialImpulse: 220,
    };

    const runA = generateFracturePieces(spec);
    const runB = generateFracturePieces(spec);

    for (let f = 0; f < 30; f += 1) {
      stepFracturePieces(runA, { dtSec: 1 / 60, reassemble: false });
      stepFracturePieces(runB, { dtSec: 1 / 60, reassemble: false });
    }
    assert.deepEqual(
      runA.map((p) => [p.x, p.y, p.angleRad]),
      runB.map((p) => [p.x, p.y, p.angleRad])
    );

    // Ensure pieces moved away from home during shatter
    assert.ok(runA.some((p) => Math.hypot(p.x - p.homeCentroidX, p.y - p.homeCentroidY) > 15));

    // Spring home back to exact original positions
    for (let f = 0; f < 180; f += 1) {
      stepFracturePieces(runA, { dtSec: 1 / 60, reassemble: true, springStiffness: 65, damping: 14 });
    }
    for (const p of runA) {
      assert.ok(Math.hypot(p.x - p.homeCentroidX, p.y - p.homeCentroidY) < 0.25);
      assert.ok(Math.abs(p.angleRad) < 0.05);
    }
  });
});
