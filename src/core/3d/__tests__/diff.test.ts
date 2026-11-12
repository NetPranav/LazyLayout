import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describe3DDiff, type Evaluated3DState } from "../diff";

describe("Phase 3D-010: describe3DDiff (Parity Monitor)", () => {
  it("returns empty array for identical states", () => {
    const state: Evaluated3DState = {
      objects: {
        cube: {
          id: "cube",
          type: "mesh",
          transform: {
            location: [1, 2, 3],
            rotationQuat: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
        },
      },
      materials: {
        mat: {
          id: "mat",
          baseColor: "#ffffff",
          metallic: 0.5,
          roughness: 0.2,
          emissive: "#000000",
        },
      },
      worldMatrices: {
        cube: new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1]),
      },
    };

    const diffs = describe3DDiff(state, state);
    assert.deepEqual(diffs, []);
  });

  it("ignores numeric differences within 1e-9 tolerance", () => {
    const s1: Evaluated3DState = {
      materials: {
        mat: {
          id: "mat",
          baseColor: "#fff",
          metallic: 0.5,
          roughness: 0.5000000000000001, // diff 1e-16
          emissive: "#000",
        },
      },
    };
    const s2: Evaluated3DState = {
      materials: {
        mat: {
          id: "mat",
          baseColor: "#fff",
          metallic: 0.5,
          roughness: 0.5,
          emissive: "#000",
        },
      },
    };

    assert.deepEqual(describe3DDiff(s1, s2), []);
  });

  it("reports differing paths when differences exceed 1e-9 tolerance", () => {
    const s1: Evaluated3DState = {
      objects: {
        cube: {
          id: "cube",
          type: "mesh",
          transform: {
            location: [1, 2, 3],
            rotationQuat: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
        },
      },
    };
    const s2: Evaluated3DState = {
      objects: {
        cube: {
          id: "cube",
          type: "mesh",
          transform: {
            location: [1, 2.0001, 3], // diff 1e-4
            rotationQuat: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
        },
      },
    };

    const diffs = describe3DDiff(s1, s2);
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0], "objects/cube/transform/location[1]");
  });

  it("reports missing or extra entities and keys", () => {
    const s1: Evaluated3DState = {
      lights: {
        sun: { id: "sun", type: "sun", color: "#fff", intensity: 10 },
      },
    };
    const s2: Evaluated3DState = {
      lights: {
        sun: { id: "sun", type: "sun", color: "#fff", intensity: 10 },
        spot: { id: "spot", type: "spot", color: "#fff", intensity: 5 },
      },
    };

    const diffs = describe3DDiff(s1, s2);
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0], "lights/spot");
  });

  it("accurately detects differences in worldMatrices", () => {
    const m1 = new Float64Array(16);
    m1[12] = 5.0;
    const m2 = new Float64Array(16);
    m2[12] = 5.00001; // diff > 1e-9

    const s1: Evaluated3DState = { worldMatrices: { hero: m1 } };
    const s2: Evaluated3DState = { worldMatrices: { hero: m2 } };

    const diffs = describe3DDiff(s1, s2);
    assert.equal(diffs.length, 1);
    assert.equal(diffs[0], "worldMatrices/hero[12]");
  });
});
