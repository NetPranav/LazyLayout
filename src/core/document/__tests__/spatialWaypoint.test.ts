import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SpatialWaypointSchema,
  ClipSchema,
  type Keyframe,
  type Clip,
} from "../motion";
import { pairKeyframesGreedy, extractClipWaypoints } from "../../timeline/keyframeOps";

describe("Milestone 1: Spatial Waypoints & Keyframe Pairing", () => {
  describe("MDM Schema & Backward Compatibility", () => {
    it("validates legacy clip without spatialTrajectories (100% backward compatible)", () => {
      const clipData = {
        id: "clip_1",
        layerId: "layer_1",
        name: "Clip 1",
        type: "entrance",
        trigger: "mount",
        duration: 2,
        easing: "power2.out",
        enabled: true,
        tracks: [
          {
            id: "trk_x",
            property: "transform.x",
            keyframes: [
              { id: "kf_x0", time: 0, value: 0 },
              { id: "kf_x1", time: 1, value: 100 },
            ],
          },
        ],
      };

      const parsed = ClipSchema.safeParse(clipData);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.equal(parsed.data.spatialTrajectories, undefined);
      }
    });

    it("validates clip with explicit spatialTrajectories", () => {
      const clipData = {
        id: "clip_2",
        layerId: "layer_1",
        name: "Clip 2",
        type: "entrance",
        trigger: "mount",
        duration: 2,
        easing: "power2.out",
        enabled: true,
        tracks: [],
        spatialTrajectories: {
          transform: {
            id: "traj_1",
            propertyGroup: "transform" as const,
            enabled: true,
            waypoints: [
              {
                id: "wp_0",
                time: 0,
                spatialOut: { x: 30, y: 0 },
                mode: "bezier" as const,
              },
              {
                id: "wp_1",
                time: 1,
                spatialIn: { x: -30, y: 0 },
                mode: "bezier" as const,
              },
            ],
          },
        },
      };

      const parsed = ClipSchema.safeParse(clipData);
      assert.equal(parsed.success, true);
      if (parsed.success) {
        assert.ok(parsed.data.spatialTrajectories?.transform);
        assert.equal(parsed.data.spatialTrajectories.transform.waypoints.length, 2);
        assert.equal(parsed.data.spatialTrajectories.transform.waypoints[0].spatialOut?.x, 30);
      }
    });

    it("rejects invalid spatial mode or non-finite control points", () => {
      const invalidWaypoint = {
        id: "wp_bad",
        time: 0,
        mode: "cubic", // invalid mode
      };
      assert.equal(SpatialWaypointSchema.safeParse(invalidWaypoint).success, false);

      const nanControlPoint = {
        id: "wp_nan",
        time: 0,
        spatialIn: { x: "zero", y: 0 }, // non-number
      };
      assert.equal(SpatialWaypointSchema.safeParse(nanControlPoint).success, false);
    });

    it("strictly preserves legacy document immutability during loading and parsing", () => {
      const legacyClip: Clip = {
        id: "clip_immutable",
        layerId: "layer_imm",
        name: "Legacy Clip",
        type: "entrance",
        trigger: "mount",
        duration: 1.5,
        easing: "linear",
        enabled: true,
        tracks: [
          {
            id: "t_imm_x",
            property: "transform.x",
            keyframes: [{ id: "k_imm_x0", time: 0, value: 10 }],
          },
          {
            id: "t_imm_y",
            property: "transform.y",
            keyframes: [{ id: "k_imm_y0", time: 0, value: 20 }],
          },
        ],
      };

      const snapshotBefore = JSON.parse(JSON.stringify(legacyClip));
      Object.freeze(legacyClip);
      Object.freeze(legacyClip.tracks);
      Object.freeze(legacyClip.tracks[0]);
      Object.freeze(legacyClip.tracks[1]);

      const parsed = ClipSchema.safeParse(legacyClip);
      assert.equal(parsed.success, true);
      const waypoints = extractClipWaypoints(legacyClip);
      assert.equal(waypoints.length, 1);

      assert.deepEqual(legacyClip, snapshotBefore);
      assert.equal(legacyClip.spatialTrajectories, undefined);
    });

    it("rejects duplicate keyframe IDs within a track via schema validation", () => {
      const duplicateClip = {
        id: "clip_dup",
        layerId: "layer_dup",
        name: "Duplicate Keyframes Clip",
        type: "entrance",
        trigger: "mount",
        duration: 2.0,
        easing: "linear",
        enabled: true,
        tracks: [
          {
            id: "t_dup",
            property: "transform.x",
            keyframes: [
              { id: "kf_unique_1", time: 0.0, value: 0 },
              { id: "kf_duplicate", time: 0.5, value: 50 },
              { id: "kf_duplicate", time: 1.0, value: 100 }, // Duplicate ID
            ],
          },
        ],
      };

      const parsed = ClipSchema.safeParse(duplicateClip);
      assert.equal(parsed.success, false);
      if (!parsed.success) {
        const hasDupIssue = parsed.error.issues.some((issue) =>
          issue.message.includes("Duplicate keyframe ID: kf_duplicate")
        );
        assert.ok(hasDupIssue, "Expected error issue for duplicate keyframe ID");
      }
    });
  });

  describe("Deterministic Greedy Nearest-Delta Pairing", () => {
    it("pairs keyframes within epsilon and computes canonical mean timestamp", () => {
      const kx: Keyframe[] = [
        { id: "kx_0", time: 0.0, value: 10 },
        { id: "kx_1", time: 1.00002, value: 50 },
      ];
      const ky: Keyframe[] = [
        { id: "ky_0", time: 0.0, value: 20 },
        { id: "ky_1", time: 1.00008, value: 60 },
      ];

      const { pairs, orphansX, orphansY } = pairKeyframesGreedy(kx, ky, 1e-4);
      assert.equal(pairs.length, 2);
      assert.equal(orphansX.length, 0);
      assert.equal(orphansY.length, 0);

      // Pair 0: exact
      assert.equal(pairs[0].keyframeX.id, "kx_0");
      assert.equal(pairs[0].keyframeY.id, "ky_0");
      assert.equal(pairs[0].canonicalTime, 0.0);

      // Pair 1: mean timestamp
      assert.equal(pairs[1].keyframeX.id, "kx_1");
      assert.equal(pairs[1].keyframeY.id, "ky_1");
      assert.ok(Math.abs(pairs[1].canonicalTime - 1.00005) < 1e-9);
      assert.ok(Math.abs(pairs[1].delta - 0.00006) < 1e-9);
    });

    it("handles the ambiguous three-candidate cluster deterministically (greedy priority)", () => {
      // ChatGPT's exact test case:
      // X1 at 0.000, Y1 at 0.010 (delta = 0.010 <= 0.02)
      // X1 at 0.000, Y2 at -0.020 (delta = 0.020 <= 0.02)
      // X2 at 0.025, Y1 at 0.010 (delta = 0.015 <= 0.02)
      // Note: |X2 - Y2| = 0.045 > 0.02 (not an edge!)
      const kx: Keyframe[] = [
        { id: "kx_1", time: 0.000, value: 100 },
        { id: "kx_2", time: 0.025, value: 200 },
      ];
      const ky: Keyframe[] = [
        { id: "ky_2", time: -0.020, value: 400 },
        { id: "ky_1", time: 0.010, value: 300 },
      ];

      const { pairs, orphansX, orphansY } = pairKeyframesGreedy(kx, ky, 0.02);

      // Closest delta is (kx_1, ky_1) with delta = 0.010
      assert.equal(pairs.length, 1);
      assert.equal(pairs[0].keyframeX.id, "kx_1");
      assert.equal(pairs[0].keyframeY.id, "ky_1");

      // kx_2 and ky_2 remain orphans as per intentional greedy specification
      assert.equal(orphansX.length, 1);
      assert.equal(orphansX[0].id, "kx_2");
      assert.equal(orphansY.length, 1);
      assert.equal(orphansY[0].id, "ky_2");
    });

    it("resolves equal-delta pairs deterministically via composite ID tie-breaker", () => {
      // X1 at 1.000, Y1 at 1.001 (delta 0.001)
      // X2 at 2.000, Y2 at 2.001 (delta 0.001)
      const kx: Keyframe[] = [
        { id: "kx_a", time: 1.000, value: 0 },
        { id: "kx_b", time: 2.000, value: 0 },
      ];
      const ky: Keyframe[] = [
        { id: "ky_a", time: 1.001, value: 0 },
        { id: "ky_b", time: 2.001, value: 0 },
      ];

      const { pairs } = pairKeyframesGreedy(kx, ky, 0.01);
      assert.equal(pairs.length, 2);
      assert.equal(pairs[0].keyframeX.id, "kx_a");
      assert.equal(pairs[0].keyframeY.id, "ky_a");
      assert.equal(pairs[1].keyframeX.id, "kx_b");
      assert.equal(pairs[1].keyframeY.id, "ky_b");
    });

    it("preserves distant-keyframe stability: edits at t=10s do not alter pairings at t=0s", () => {
      const kx: Keyframe[] = [
        { id: "kx_0", time: 0.1000, value: 0 },
        { id: "kx_1", time: 0.5000, value: 0 },
      ];
      const ky: Keyframe[] = [
        { id: "ky_0", time: 0.10005, value: 0 },
        { id: "ky_1", time: 0.50005, value: 0 },
      ];

      const baseline = pairKeyframesGreedy(kx, ky, 1e-4);
      assert.equal(baseline.pairs.length, 2);

      // Add a distant keyframe at t = 10s
      const kxWithDistant: Keyframe[] = [...kx, { id: "kx_distant", time: 10.0, value: 0 }];
      const kyWithDistant: Keyframe[] = [...ky, { id: "ky_distant", time: 10.00003, value: 0 }];

      const withDistant = pairKeyframesGreedy(kxWithDistant, kyWithDistant, 1e-4);
      assert.equal(withDistant.pairs.length, 3);
      assert.equal(withDistant.pairs[0].keyframeX.id, baseline.pairs[0].keyframeX.id);
      assert.equal(withDistant.pairs[0].keyframeY.id, baseline.pairs[0].keyframeY.id);
      assert.equal(withDistant.pairs[1].keyframeX.id, baseline.pairs[1].keyframeX.id);
      assert.equal(withDistant.pairs[1].keyframeY.id, baseline.pairs[1].keyframeY.id);
    });

    it("strictly respects the epsilon tolerance boundary", () => {
      const kx: Keyframe[] = [{ id: "kx_0", time: 1.0, value: 0 }];
      // At boundary: 1.0 + 1e-4
      const kyBoundary: Keyframe[] = [{ id: "ky_0", time: 1.0 + 1e-4, value: 0 }];
      const resBoundary = pairKeyframesGreedy(kx, kyBoundary, 1e-4);
      assert.equal(resBoundary.pairs.length, 1);

      // Outside boundary: 1.0 + 1.001e-4
      const kyOutside: Keyframe[] = [{ id: "ky_0", time: 1.0 + 1.001e-4, value: 0 }];
      const resOutside = pairKeyframesGreedy(kx, kyOutside, 1e-4);
      assert.equal(resOutside.pairs.length, 0);
      assert.equal(resOutside.orphansX.length, 1);
      assert.equal(resOutside.orphansY.length, 1);
    });

    it("enumerates all candidate edges in dense clusters where K = Nx * Ny", () => {
      // 4 keyframes on X and 4 keyframes on Y, all clustered within epsilon/2
      const epsilon = 1e-4;
      const baseTime = 1.0;
      const Nx = 4;
      const Ny = 4;

      const kx: Keyframe[] = [];
      const ky: Keyframe[] = [];

      for (let i = 0; i < Nx; i++) {
        kx.push({
          id: `kx_dense_${i}`,
          time: baseTime + (i * epsilon) / 10,
          value: i * 10,
        });
      }

      for (let j = 0; j < Ny; j++) {
        ky.push({
          id: `ky_dense_${j}`,
          time: baseTime + (j * epsilon) / 10 + 1e-6,
          value: j * 10,
        });
      }

      // Every kx is within epsilon of every ky: |kx_i - ky_j| <= 4e-5 < 1e-4
      // The candidate generation loop evaluates all Nx * Ny = 16 candidates
      const res = pairKeyframesGreedy(kx, ky, epsilon);

      // Greedy assignment pairs exactly 4 (min(Nx, Ny)), leaves 0 orphans
      assert.equal(res.pairs.length, 4);
      assert.equal(res.orphansX.length, 0);
      assert.equal(res.orphansY.length, 0);

      // Verify that pairs are matched greedily by smallest delta
      for (const pair of res.pairs) {
        assert.ok(pair.delta <= epsilon);
      }
    });
  });

  describe("extractClipWaypoints Integration", () => {
    it("extracts waypoints and samples missing coordinates for orphans", () => {
      const clip: Clip = {
        id: "clip_sample",
        layerId: "l1",
        name: "Motion",
        type: "entrance",
        trigger: "mount",
        duration: 3,
        easing: "linear",
        enabled: true,
        tracks: [
          {
            id: "t_x",
            property: "transform.x",
            keyframes: [
              { id: "kx_0", time: 0, value: 100 },
              { id: "kx_1", time: 1, value: 200 },
              { id: "kx_2", time: 2, value: 300 }, // Orphan on X
            ],
          },
          {
            id: "t_y",
            property: "transform.y",
            keyframes: [
              { id: "ky_0", time: 0, value: 50 },
              { id: "ky_1", time: 1, value: 150 },
              // No keyframe at t=2 on Y
            ],
          },
        ],
      };

      const waypoints = extractClipWaypoints(clip, { "transform.y": 0 });
      assert.equal(waypoints.length, 3);

      // Waypoint 0
      assert.equal(waypoints[0].time, 0);
      assert.equal(waypoints[0].x, 100);
      assert.equal(waypoints[0].y, 50);

      // Waypoint 1
      assert.equal(waypoints[1].time, 1);
      assert.equal(waypoints[1].x, 200);
      assert.equal(waypoints[1].y, 150);

      // Waypoint 2: Orphan on X at t=2
      assert.equal(waypoints[2].time, 2);
      assert.equal(waypoints[2].x, 300);
      // Track Y sampled at t=2 clamps to its last keyframe value (150)
      assert.equal(waypoints[2].y, 150);
      assert.equal(waypoints[2].isOrphanX, true);
    });
  });
});
