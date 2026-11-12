import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { MAIN_COMPOSITION_ID } from "../../document/compositions";
import { evaluate } from "../evaluate";
import { evaluate3D } from "../evaluate3d";
import { describe3DDiff } from "../../3d/diff";
import { quatFromEuler, quatSlerp } from "../../3d/math";
import { validateMotionDocument } from "../../document/schema";

describe("Phase 3D-010: 3D Evaluation Kernel", () => {
  it("tracks evaluate to the exact expected values at 5 times (start, eased midpoint, linear, held, and end)", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);

    b.clip(layerId, {
      name: "3D Motion",
      type: "entrance",
      trigger: "mount",
      duration: 3,
      easing: "linear",
      tracks: [
        {
          id: "trk_loc_x",
          property: "3d:objects/box/transform.location.x",
          keyframes: [
            { id: "k0", time: 0, value: 10 },
            // Segment 0 to 1 with power1.in (quad-in: 0.5^2 = 0.25 -> 10 + 10*0.25 = 12.5)
            { id: "k1", time: 1, value: 20, ease: "power1.in" },
            // Segment 1 to 2 with linear interpolation (midpoint 1.5 -> 25)
            { id: "k2", time: 2, value: 30, ease: "linear", hold: true },
            // Segment 2 to 3 held at 30 until time 3
            { id: "k3", time: 3, value: 40, ease: "linear" },
          ],
        },
      ],
    });

    const doc = b.build();
    doc.objects = {
      box: {
        id: "box",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };

    // 1. At start keyframe (t=0): exact start value (10)
    const state0 = evaluate3D(doc, 0);
    assert.equal(state0.objects?.box.transform.location[0], 10);

    // 2. Between keyframes with easing (t=0.5): power1.in(0.5) = 0.25 -> 10 + (20-10)*0.25 = 12.5
    const state0_5 = evaluate3D(doc, 0.5);
    const loc0_5 = state0_5.objects?.box.transform.location[0];
    assert.ok(Math.abs((loc0_5 ?? 0) - 12.5) < 1e-9, `expected 12.5, got ${loc0_5}`);

    // 3. Between linear keyframes (t=1.5): exact lerp -> 20 + (30-20)*0.5 = 25
    const state1_5 = evaluate3D(doc, 1.5);
    const loc1_5 = state1_5.objects?.box.transform.location[0];
    assert.ok(Math.abs((loc1_5 ?? 0) - 25) < 1e-9, `expected 25, got ${loc1_5}`);

    // 4. On a held keyframe (t=2.5): k2 has hold=true, so value stays 30
    const state2_5 = evaluate3D(doc, 2.5);
    assert.equal(state2_5.objects?.box.transform.location[0], 30);

    // 5. At/after end keyframe (t=3.5): holds end value (40)
    const state3_5 = evaluate3D(doc, 3.5);
    assert.equal(state3_5.objects?.box.transform.location[0], 40);
  });

  it("Euler->quat: converts transform.rotationEuler.{x,y,z} to quaternion after interpolation", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);

    b.clip(layerId, {
      name: "Euler Rotation",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      tracks: [
        {
          id: "trk_rot_x",
          property: "3d:objects/box/transform.rotationEuler.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 1, value: Math.PI / 2 }, // 90 deg around X
          ],
        },
      ],
    });

    const doc = b.build();
    doc.objects = {
      box: {
        id: "box",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };

    const state = evaluate3D(doc, 1);
    const quat = state.objects?.box.transform.rotationQuat;
    assert.ok(quat, "rotationQuat should exist");

    // Expected quaternion for 90 deg (pi/2) rotation around X axis:
    // [sin(pi/4), 0, 0, cos(pi/4)] = [Math.SQRT1_2, 0, 0, Math.SQRT1_2]
    const expected = quatFromEuler("XYZ", Math.PI / 2, 0, 0);
    assert.ok(Math.abs(quat[0] - expected[0]) < 1e-9, `quat.x expected ${expected[0]}, got ${quat[0]}`);
    assert.ok(Math.abs(quat[1] - expected[1]) < 1e-9, `quat.y expected ${expected[1]}, got ${quat[1]}`);
    assert.ok(Math.abs(quat[2] - expected[2]) < 1e-9, `quat.z expected ${expected[2]}, got ${quat[2]}`);
    assert.ok(Math.abs(quat[3] - expected[3]) < 1e-9, `quat.w expected ${expected[3]}, got ${quat[3]}`);

    // Also test through evaluate() synthesis
    const layerProps = evaluate(doc, MAIN_COMPOSITION_ID, layerId, 1);
    const synthQuat = layerProps["3d:objects/box/transform.rotationQuat"] as number[];
    assert.ok(synthQuat, "synthesized quaternion should exist in evaluate() resolved props");
    assert.ok(Math.abs(synthQuat[0] - expected[0]) < 1e-9);
    assert.ok(Math.abs(synthQuat[3] - expected[3]) < 1e-9);
  });

  it("slerp midpoint: interpolates rotationQuat tracks using spherical linear interpolation", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);

    // 0 deg to 90 deg around Y axis:
    // q0 = [0, 0, 0, 1]
    // q1 = [0, sin(pi/4), 0, cos(pi/4)] = [0, Math.SQRT1_2, 0, Math.SQRT1_2]
    const q0: [number, number, number, number] = [0, 0, 0, 1];
    const q1: [number, number, number, number] = [0, Math.SQRT1_2, 0, Math.SQRT1_2];

    b.clip(layerId, {
      name: "Quat Slerp",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      tracks: [
        {
          id: "trk_quat",
          property: "3d:objects/box/transform.rotationQuat",
          keyframes: [
            { id: "k0", time: 0, value: q0 },
            { id: "k1", time: 1, value: q1 },
          ],
        },
      ],
    });

    const doc = b.build();
    doc.objects = {
      box: {
        id: "box",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };

    const midState = evaluate3D(doc, 0.5);
    const midQuat = midState.objects?.box.transform.rotationQuat;
    assert.ok(midQuat);

    // Midpoint of 90 deg is 45 deg around Y:
    // angle = pi/4, half-angle = pi/8:
    // [0, sin(pi/8), 0, cos(pi/8)]
    const expected = quatSlerp(q0, q1, 0.5);
    assert.ok(Math.abs(midQuat[0] - expected[0]) < 1e-9);
    assert.ok(Math.abs(midQuat[1] - expected[1]) < 1e-9, `got ${midQuat[1]}, expected ${expected[1]}`);
    assert.ok(Math.abs(midQuat[2] - expected[2]) < 1e-9);
    assert.ok(Math.abs(midQuat[3] - expected[3]) < 1e-9, `got ${midQuat[3]}, expected ${expected[3]}`);

    // Verify slerp unit length: norm = 1.0
    const norm = Math.hypot(midQuat[0], midQuat[1], midQuat[2], midQuat[3]);
    assert.ok(Math.abs(norm - 1.0) < 1e-9, "slerped quaternion must be normalized");
  });

  it("scrubbing order independence: evaluating at t=3, then t=1, then t=3 gives identical results", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);

    b.clip(layerId, {
      name: "Complex 3D Animation",
      type: "entrance",
      trigger: "mount",
      duration: 5,
      easing: "linear",
      tracks: [
        {
          id: "trk1",
          property: "3d:objects/box/transform.location.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 2, value: 20, ease: "power2.out" },
            { id: "k2", time: 4, value: 40, ease: "sine.inOut" },
          ],
        },
        {
          id: "trk2",
          property: "3d:materials/gold/roughness",
          keyframes: [
            { id: "m0", time: 0, value: 0.1 },
            { id: "m1", time: 3, value: 0.9, ease: "power1.in" },
          ],
        },
        {
          id: "trk3",
          property: "3d:lights/sun/intensity",
          keyframes: [
            { id: "l0", time: 0, value: 100 },
            { id: "l1", time: 5, value: 500, ease: "linear" },
          ],
        },
      ],
    });

    const doc = b.build();
    doc.objects = {
      box: {
        id: "box",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };
    doc.materials = {
      gold: {
        id: "gold",
        baseColor: "#ffd700",
        metallic: 1,
        roughness: 0.1,
        emissive: "#000000",
      },
    };
    doc.lights = {
      sun: {
        id: "sun",
        type: "sun",
        color: "#ffffff",
        intensity: 100,
      },
    };

    // Scrub: t = 3, then t = 1, then t = 3
    const stateA = evaluate3D(doc, 3);
    const stateB = evaluate3D(doc, 1);
    const stateC = evaluate3D(doc, 3);

    // State at t=1 must differ from t=3
    const diffAB = describe3DDiff(stateA, stateB);
    assert.ok(diffAB.length > 0, "state at t=3 must differ from state at t=1");

    // State at t=3 must be byte-for-byte / identical within 1e-9 tolerance
    const diffAC = describe3DDiff(stateA, stateC);
    assert.deepEqual(diffAC, [], "re-evaluating at t=3 after scrubbing to t=1 must be identical");
  });

  it("existing 2D evaluate outputs remain byte-identical for a v6 fixture", () => {
    const b = new DocBuilder();
    const id = b.layer("container", "Card", null, {
      "content.text": "Legacy Layer",
      "appearance.opacity": 0.5,
      "transform.x": 100,
      "transform.y": 200,
    });
    b.state(id, "hovered", { "appearance.opacity": 0.9, "transform.x": 120 });
    b.clip(id, {
      name: "Entrance",
      type: "entrance",
      trigger: "mount",
      duration: 1,
      easing: "linear",
      tracks: [
        {
          id: "t_y",
          property: "transform.y",
          keyframes: [
            { id: "k0", time: 0, value: 200 },
            { id: "k1", time: 1, value: 50, ease: "power1.in" },
          ],
        },
      ],
    });
    const doc = b.build();

    // Compute expected snapshot using pure 2D formula
    // At t=0.5: power1.in(0.5) = 0.25 -> 200 + (50 - 200) * 0.25 = 162.5
    const resolved = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5);

    assert.equal(resolved["content.text"], "Legacy Layer");
    assert.equal(resolved["appearance.opacity"], 0.5);
    assert.equal(resolved["transform.x"], 100);
    assert.ok(Math.abs((resolved["transform.y"] as number) - 162.5) < 1e-6);

    // Active state overlay check
    const hovered = evaluate(doc, MAIN_COMPOSITION_ID, id, 0.5, { activeStates: { [id]: "hovered" } });
    assert.equal(hovered["appearance.opacity"], 0.9);
    assert.equal(hovered["transform.x"], 120);
    assert.ok(Math.abs((hovered["transform.y"] as number) - 162.5) < 1e-6);
  });

  it("referential validation accepts 3D property paths without schema version bump", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);
    b.clip(layerId, {
      name: "Valid 3D Clip",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "trk1",
          property: "3d:objects/box_01/transform.location.x",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 1, value: 5 },
          ],
        },
        {
          id: "trk2",
          property: "3d:materials/mat_gold/roughness",
          keyframes: [
            { id: "m0", time: 0, value: 0.2 },
            { id: "m1", time: 1, value: 0.8 },
          ],
        },
      ],
    });

    const doc = b.build();
    doc.objects = {
      box_01: {
        id: "box_01",
        type: "mesh",
        transform: {
          location: [0, 0, 0],
          rotationQuat: [0, 0, 0, 1],
          scale: [1, 1, 1],
        },
      },
    };
    doc.materials = {
      mat_gold: {
        id: "mat_gold",
        baseColor: "#ffd700",
        metallic: 1,
        roughness: 0.2,
        emissive: "#000000",
      },
    };

    const validation = validateMotionDocument(doc);
    assert.equal(validation.ok, true, !validation.ok ? JSON.stringify(validation.issues) : "");
  });

  it("referential validation catches invalid 3D paths or non-existent 3D entities", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);
    b.clip(layerId, {
      name: "Invalid 3D Clip",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "trk_bad",
          property: "3d:unknown_table/box/prop",
          keyframes: [{ id: "k0", time: 0, value: 0 }],
        },
      ],
    });

    const doc = b.build();
    const validation = validateMotionDocument(doc);
    assert.equal(validation.ok, false);
    if (!validation.ok) {
      assert.ok(validation.issues.some((i) => i.message.includes("Unknown 3D table")));
    }
  });
});
