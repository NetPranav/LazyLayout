/**
 * @file spawner.test.ts
 * @description Phase 170 tests: pooled Spawn instances within per-tier caps,
 * lifetime + exit transition, optional bodies, document non-persistence filter,
 * and deterministic click-confetti tape replay parity.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SPAWNER_TIER_CAPS,
  createEphemeralSpawner,
  filterNonEphemeralDocumentLayers,
} from "../spawner";

describe("Phase 170: Spawner", () => {
  it("enforces per-tier pool caps on rapid click-confetti bursts and strips ephemeral layers from save", () => {
    const spawner = createEphemeralSpawner({ tier: "T1", seed: 170 });
    assert.equal(spawner.getPoolCap(), SPAWNER_TIER_CAPS.T1);

    for (let click = 0; click < 5; click++) {
      spawner.spawnBurst(
        { kind: "pointer", x: 320 + click * 10, y: 240 },
        {
          templateLayerId: "star_shape",
          count: 30,
          speedMinPxPerSec: 180,
          speedMaxPxPerSec: 420,
          angleCenterDeg: -90,
          spreadDeg: 90,
          spinDegPerSec: 240,
          variety: 0.7,
          lifetimeSec: 1.2,
          exitFadeSec: 0.25,
          attachPhysicsBody: true,
        },
        click * 0.1
      );
      assert.ok(spawner.getActiveInstances().length <= SPAWNER_TIER_CAPS.T1);
    }

    const active = spawner.getActiveInstances();
    assert.equal(active.length, SPAWNER_TIER_CAPS.T1);
    assert.ok(active.every((i) => i.body !== null && i.isEphemeral === true));

    const persisted = filterNonEphemeralDocumentLayers([
      { id: "star_shape", isEphemeral: false },
      ...active.map((i) => ({ id: i.poolId, isEphemeral: i.isEphemeral })),
    ]);
    assert.deepEqual(persisted, [{ id: "star_shape", isEphemeral: false }]);
  });

  it("replays click-confetti trajectory and exit fade deterministically", () => {
    const runTape = () => {
      const spawner = createEphemeralSpawner({ tier: "T0", seed: 999 });
      spawner.spawnBurst(
        { kind: "pin", targetLayerId: "cta_btn", x: 200, y: 150 },
        {
          templateLayerId: "star_shape",
          count: 10,
          speedMinPxPerSec: 120,
          speedMaxPxPerSec: 260,
          angleCenterDeg: -90,
          spreadDeg: 60,
          spinDegPerSec: 180,
          variety: 0.5,
          lifetimeSec: 0.5,
          exitFadeSec: 0.2,
        },
        0
      );
      for (let f = 0; f < 24; f++) {
        spawner.step(1 / 60);
      }
      return spawner.getActiveInstances().map((i) => ({
        poolId: i.poolId,
        x: i.x,
        y: i.y,
        opacity: i.opacity,
      }));
    };

    const run1 = runTape();
    const run2 = runTape();
    assert.deepEqual(run1, run2);
    assert.ok(run1.length === 10);
    assert.ok(run1[0]!.opacity < 1, "expected exit fade after 0.4s of 0.5s lifetime");
  });
});
