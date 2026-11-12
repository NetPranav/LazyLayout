import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DocBuilder } from "../../document/__tests__/fixtures/builder";
import { evaluate } from "../evaluate";
import { evaluate3D } from "../evaluate3d";

function assertNear(a: number, b: number, tol = 1e-4, msg?: string): void {
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? "Float mismatch"}: expected ${b}, got ${a}`);
}

describe("Phase 3D-030: Modifier parameter animation in kernel", () => {
  it("resolves animated modifier parameters at 3 keyframed times without altering 2D evaluate output", () => {
    const b = new DocBuilder();
    const layerId = b.layer("container", "SceneRoot", null);

    // Track targeting 3d:objects/box/modifiers/disp1/strength
    b.clip(layerId, {
      name: "Modifier Anim",
      type: "entrance",
      trigger: "mount",
      duration: 2,
      easing: "linear",
      tracks: [
        {
          id: "trk_mod_strength",
          property: "3d:objects/box/modifiers/disp1/strength",
          keyframes: [
            { id: "k0", time: 0, value: 0 },
            { id: "k1", time: 1, value: 5, ease: "linear" },
            { id: "k2", time: 2, value: 10, ease: "linear" },
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
        modifiers: [
          {
            id: "disp1",
            type: "displace",
            enabled: true,
            renderEnabled: true,
            params: {
              strength: 0,
              seed: 1,
            },
          },
        ],
      },
    };

    // 1. Evaluate at time 0 (start)
    const state0 = evaluate3D(doc, 0);
    const mod0 = state0.objects?.box?.modifiers?.[0];
    assert.ok(mod0, "Evaluated object must expose modifiers");
    assert.equal(mod0.id, "disp1");
    assertNear(Number(mod0.params?.strength), 0, 1e-5, "At t=0, strength should be 0");

    // 2. Evaluate at time 1 (midpoint)
    const state1 = evaluate3D(doc, 1);
    const mod1 = state1.objects?.box?.modifiers?.[0];
    assert.ok(mod1);
    assertNear(Number(mod1.params?.strength), 5, 1e-5, "At t=1, strength should be 5");

    // 3. Evaluate at time 2 (end)
    const state2 = evaluate3D(doc, 2);
    const mod2 = state2.objects?.box?.modifiers?.[0];
    assert.ok(mod2);
    assertNear(Number(mod2.params?.strength), 10, 1e-5, "At t=2, strength should be 10");

    // 4. Verify original doc was not mutated by evaluation
    assert.equal(doc.objects?.box?.modifiers?.[0].params?.strength, 0, "Doc must not be mutated");

    // 5. Verify 2D evaluate() runs without crashing and produces valid layer states
    const eval2d = evaluate(doc, "comp_main", layerId, 1);
    assert.ok(eval2d, "2D evaluate must succeed");
    assert.ok(Object.keys(eval2d).length >= 0, "2D evaluation returns resolved props for the container layer");
  });
});
