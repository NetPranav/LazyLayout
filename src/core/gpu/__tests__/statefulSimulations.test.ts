import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createStatefulSimulation,
  resolveSimulationTierScale,
  type SimulationModuleKind,
  type SimulationPointerSplat,
} from "../statefulSimulations";

const SAMPLE_TAPE: SimulationPointerSplat[] = [
  { timeSec: 0.25, xNorm: 0.35, yNorm: 0.45, vxNorm: 0.8, vyNorm: -0.5, impulseStrength: 1.2 },
  { timeSec: 1.5, xNorm: 0.65, yNorm: 0.55, vxNorm: -0.6, vyNorm: 0.9, impulseStrength: 1.4 },
  { timeSec: 4.0, xNorm: 0.5, yNorm: 0.3, vxNorm: 0.4, vyNorm: 0.7, impulseStrength: 1.1 },
  { timeSec: 7.5, xNorm: 0.25, yNorm: 0.7, vxNorm: 0.9, vyNorm: 0.2, impulseStrength: 1.3 },
];

describe("Phase 184: Stateful simulations & replay (closes AUD-48)", () => {
  it("scales simulation grid resolution smoothly across device tiers", () => {
    assert.ok(resolveSimulationTierScale("T0") < resolveSimulationTierScale("T1"));
    assert.ok(resolveSimulationTierScale("T1") < resolveSimulationTierScale("T2"));
    assert.ok(resolveSimulationTierScale("T2") < resolveSimulationTierScale("T3"));
  });

  it("replays deterministically across all 5 simulation modules and stays exact during 10s back-and-forth scrubbing <= 50 ms per seek", () => {
    const kinds: SimulationModuleKind[] = [
      "stable_fluid",
      "spring_lattice",
      "verlet_cloth",
      "metaballs_sdf",
      "rigid_bodies",
    ];
    const checkpoints = [0.5, 2.0, 4.5, 7.0, 10.0];

    for (const kind of kinds) {
      const sim = createStatefulSimulation({
        kind,
        seed: 42,
        tier: "T2",
        snapshotIntervalFrames: 15,
        splatTape: SAMPLE_TAPE,
      });

      // Pre-run across 10 s timeline to capture reference hashes at 5 checkpoints
      const expectedHashes = new Map<number, string>();
      for (const t of checkpoints) {
        sim.advanceTo(t);
        expectedHashes.set(t, sim.getStateHash());
      }
      assert.ok(sim.getSnapshotCount() >= 20);

      // Scrub backward and forward repeatedly over 10 s
      const scrubOrder = [7.0, 0.5, 10.0, 2.0, 4.5, 0.5, 7.0, 4.5, 10.0, 2.0];
      for (const t of scrubOrder) {
        const res = sim.seekToTime(t);
        assert.equal(res.stateHash, expectedHashes.get(t), `${kind} state mismatch at t=${t}s`);
        assert.ok(
          res.seekElapsedMs <= 50,
          `${kind} seek to t=${t}s took ${res.seekElapsedMs.toFixed(2)}ms (> 50ms budget)`
        );
      }
    }
  });
});
