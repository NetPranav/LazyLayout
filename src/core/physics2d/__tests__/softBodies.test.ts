/**
 * @file softBodies.test.ts
 * @description Phase 166 tests: vector-outline soft bodies, hover wobble, sharp vector
 * path deformation, 1,000-impact non-self-intersection invariant, and replay determinism.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createSoftBodyFromPolygon,
  hasPolygonSelfIntersection,
  type SoftVertex2D,
} from "../softBodies";

function createButtonOutline(sides = 12, rx = 90, ry = 36, cx = 200, cy = 120): readonly SoftVertex2D[] {
  const pts: SoftVertex2D[] = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  return pts;
}

function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("Phase 166: Soft bodies & jelly", () => {
  it("wobbles on hover while preserving sharp SVG vector path edges", () => {
    const jelly = createSoftBodyFromPolygon("jelly_btn", createButtonOutline());
    const initialPath = jelly.toSvgPathD();

    jelly.applyHoverWobble(240, 120, 420, -240);
    for (let i = 0; i < 10; i++) {
      jelly.step(1 / 60);
    }

    const deformedPath = jelly.toSvgPathD();
    assert.notEqual(deformedPath, initialPath);
    assert.ok(deformedPath.startsWith("M") && deformedPath.endsWith(" Z"));
    assert.equal(hasPolygonSelfIntersection(jelly.getVertices()), false);
  });

  it("never self-intersects across 1,000 seeded random impacts and replays identically", () => {
    const runRandomImpacts = () => {
      const rand = makePrng(166);
      const jelly = createSoftBodyFromPolygon("jelly_stress", createButtonOutline(16, 80, 48, 0, 0), {
        edgeStiffness: 0.7,
        shapeMemoryStiffness: 75,
        pressure: 220,
      });

      const checkpoints: SoftVertex2D[][] = [];
      for (let i = 0; i < 1000; i++) {
        const hitX = (rand() - 0.5) * 160;
        const hitY = (rand() - 0.5) * 96;
        const ix = (rand() - 0.5) * 900;
        const iy = (rand() - 0.5) * 900;
        jelly.applyImpact(hitX, hitY, ix, iy, 64);
        jelly.step(1 / 60);
        assert.equal(
          hasPolygonSelfIntersection(jelly.getVertices()),
          false,
          `self-intersection detected at impact ${i}`
        );
        if (i % 250 === 249) {
          checkpoints.push([...jelly.getVertices()]);
        }
      }
      return checkpoints;
    };

    const run1 = runRandomImpacts();
    const run2 = runRandomImpacts();
    assert.deepEqual(run1, run2);
  });
});
