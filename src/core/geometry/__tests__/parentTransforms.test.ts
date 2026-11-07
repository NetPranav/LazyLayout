import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  identityMatrix,
  multiplyAffineMatrices,
  applyAffineMatrix,
  createLayerLocalMatrix,
  invertAffineMatrix,
  validateParentLink,
  computeComposedWorldMatrix,
  computeReparentedLocalTransform,
  getLayerParentRef,
} from "../parentTransforms";
import { createLayer, createDocumentFromLayers } from "../../document/factories";
import type { Layer } from "../../document/schema";
import { documentCommands, getDocument, historyCommands } from "../../store/useDocumentStore";
import { setDocument } from "../../store/documentState";
import { useHistoryStore } from "../../store/useHistoryStore";

const close = (actual: number, expected: number, tol = 1e-5, msg = "") => {
  const diff = Math.abs(actual - expected);
  assert.ok(diff <= tol, `${msg} (actual: ${actual}, expected: ${expected}, diff: ${diff})`);
};

describe("Phase 73: 2D Affine Matrix & Parenting Engine", () => {
  it("identity matrix preserves points", () => {
    const id = identityMatrix();
    const pt: [number, number] = [123.45, -67.89];
    const out = applyAffineMatrix(id, pt);
    close(out[0], pt[0]);
    close(out[1], pt[1]);
  });

  it("column-vector multiplication order is strictly non-commutative (MA · MB != MB · MA)", () => {
    // MA: 90 deg rotation about origin
    const mA = createLayerLocalMatrix({
      anchor: [0, 0],
      rotationDeg: 90,
      scaleX: 1,
      scaleY: 1,
    });
    // MB: non-uniform scale [2, 0.5]
    const mB = createLayerLocalMatrix({
      anchor: [0, 0],
      rotationDeg: 0,
      scaleX: 2,
      scaleY: 0.5,
    });

    const mAB = multiplyAffineMatrices(mA, mB); // Apply B then A
    const mBA = multiplyAffineMatrices(mB, mA); // Apply A then B

    const testPt: [number, number] = [10, 20];
    const ptAB = applyAffineMatrix(mAB, testPt); // B scales to (20, 10), then A rotates 90 deg to (-10, 20)
    const ptBA = applyAffineMatrix(mBA, testPt); // A rotates to (-20, 10), then B scales to (-40, 5)

    close(ptAB[0], -10);
    close(ptAB[1], 20);

    close(ptBA[0], -40);
    close(ptBA[1], 5);

    assert.notDeepEqual(ptAB, ptBA, "Column-vector multiplication order MA·MB must differ from MB·MA");
  });

  it("analytically calculates and verifies golden matrix for a 3-level parent chain (C -> B -> A)", () => {
    /**
     * Analytical derivation:
     * Grandparent A:
     *   Anchor = [0, 0], Translation = [100, 200], Rotation = 90°, Scale = [1, 1]
     *   MA = [ 0, 1, -1, 0, 100, 200 ]
     *
     * Parent B:
     *   Anchor = [50, 50], Translation = [50, 0], Rotation = 0°, Scale = [2, 0.5]
     *   MB = [ 2, 0, 0, 0.5, 0, 25 ]
     *
     * Child C:
     *   Anchor = [10, 20], Translation = [10, 10], Rotation = 45°, Scale = [1, 1]
     *   c45 = s45 = sqrt(2)/2
     *   MC = [ sqrt(2)/2, sqrt(2)/2, -sqrt(2)/2, sqrt(2)/2, 20 + 5*sqrt(2), 30 - 15*sqrt(2) ]
     *
     * Composed M_AB = MA · MB:
     *   M_AB = [ 0, 2, -0.5, 0, 75, 200 ]
     *
     * Composed M_ABC = M_AB · MC:
     *   a = -sqrt(2)/4 ≈ -0.35355339
     *   b = sqrt(2) ≈ 1.41421356
     *   c = -sqrt(2)/4 ≈ -0.35355339
     *   d = -sqrt(2) ≈ -1.41421356
     *   e = 60 + 7.5*sqrt(2) ≈ 70.60660172
     *   f = 240 + 10*sqrt(2) ≈ 254.14213562
     */
    const mA = createLayerLocalMatrix({
      anchor: [0, 0],
      transformOffset: [100, 200],
      rotationDeg: 90,
      scaleX: 1,
      scaleY: 1,
    });

    const mB = createLayerLocalMatrix({
      anchor: [50, 50],
      transformOffset: [50, 0],
      rotationDeg: 0,
      scaleX: 2,
      scaleY: 0.5,
    });

    const mC = createLayerLocalMatrix({
      anchor: [10, 20],
      transformOffset: [10, 10],
      rotationDeg: 45,
      scaleX: 1,
      scaleY: 1,
    });

    const mComposed = multiplyAffineMatrices(multiplyAffineMatrices(mA, mB), mC);

    const s2 = Math.SQRT2;
    const goldenA = -s2 / 4;
    const goldenB = s2;
    const goldenC = -s2 / 4;
    const goldenD = -s2;
    const goldenE = 60 + 7.5 * s2;
    const goldenF = 240 + 10 * s2;

    close(mComposed[0], goldenA, 1e-5, "matrix element a");
    close(mComposed[1], goldenB, 1e-5, "matrix element b");
    close(mComposed[2], goldenC, 1e-5, "matrix element c");
    close(mComposed[3], goldenD, 1e-5, "matrix element d");
    close(mComposed[4], goldenE, 1e-5, "matrix element e");
    close(mComposed[5], goldenF, 1e-5, "matrix element f");

    // Also verify transforming point [10, 20] (anchor of C):
    // In local space of C, [10, 20] translates by offset [10, 10] to [20, 30] in B's local space.
    // In B, point [20, 30] relative to anchor [50, 50] is delta [-30, -20],
    // scaled by [2, 0.5] => [-60, -10], plus anchor [50, 50] + offset [50, 0] => [40, 40] in A's space.
    // In A, point [40, 40] rotated 90° about [0, 0] is [-40, 40], plus offset [100, 200] => [60, 240].
    const ptTransformed = applyAffineMatrix(mComposed, [10, 20]);
    close(ptTransformed[0], 60, 1e-5, "anchor C world x");
    close(ptTransformed[1], 240, 1e-5, "anchor C world y");
  });

  it("prevents circular dependencies and self-parenting in DAG validation", () => {
    const layers: Record<string, Layer> = {
      a: createLayer({ id: "a", archetype: "rectangle" }) as Layer,
      b: createLayer({ id: "b", archetype: "rectangle", parentRef: "a" }) as Layer,
      c: createLayer({ id: "c", archetype: "rectangle", parentRef: "b" }) as Layer,
    };

    // Self parenting
    const selfCheck = validateParentLink(layers, "a", "a");
    assert.equal(selfCheck.valid, false);
    assert.match(selfCheck.reason ?? "", /itself/);

    // 2-node cycle: A -> B, trying to set A's parent to B
    const cycle2 = validateParentLink(layers, "a", "b");
    assert.equal(cycle2.valid, false);
    assert.match(cycle2.reason ?? "", /cycle|cyclic/i);

    // 3-node cycle: C -> B -> A, trying to set A's parent to C
    const cycle3 = validateParentLink(layers, "a", "c");
    assert.equal(cycle3.valid, false);
    assert.match(cycle3.reason ?? "", /cycle|cyclic/i);

    // Valid link: New layer D parented to C
    const validLink = validateParentLink(layers, "d", "c");
    assert.equal(validLink.valid, true);

    // Unparenting (null) is always valid
    const nullLink = validateParentLink(layers, "a", null);
    assert.equal(nullLink.valid, true);
  });

  it("inverts non-singular affine matrices correctly (M · M^-1 = I)", () => {
    const m = createLayerLocalMatrix({
      anchor: [25, 35],
      transformOffset: [80, -40],
      rotationDeg: 37,
      scaleX: 1.5,
      scaleY: 0.8,
    });

    const inv = invertAffineMatrix(m);
    assert.ok(inv !== null, "Inversion must succeed for non-singular matrix");

    const prod = multiplyAffineMatrices(m, inv);
    close(prod[0], 1, 1e-5);
    close(prod[1], 0, 1e-5);
    close(prod[2], 0, 1e-5);
    close(prod[3], 1, 1e-5);
    close(prod[4], 0, 1e-5);
    close(prod[5], 0, 1e-5);
  });

  it("handles singular matrices (zero scale) safely without throwing or NaN", () => {
    const singularM = createLayerLocalMatrix({
      anchor: [0, 0],
      rotationDeg: 0,
      scaleX: 0,
      scaleY: 0,
    });

    const inv = invertAffineMatrix(singularM);
    assert.equal(inv, null, "Singular matrix must return null without throwing");
  });

  it("preserves transformed world geometry upon reparenting (0 visual jump)", () => {
    // Parent layer P rotated 45° and translated [100, 100]
    const pLayer = createLayer({
      id: "p",
      archetype: "rectangle",
      properties: {
        "frame.x": 0,
        "frame.y": 0,
        "frame.width": 200,
        "frame.height": 200,
        "transform.x": 100,
        "transform.y": 100,
        "transform.rotate": 45,
        "transform.scaleX": 1,
        "transform.scaleY": 1,
      },
    }) as Layer;

    // Child layer C currently at [50, 50], rotated 15°
    const cLayer = createLayer({
      id: "c",
      archetype: "rectangle",
      properties: {
        "frame.x": 50,
        "frame.y": 50,
        "frame.width": 100,
        "frame.height": 100,
        "transform.x": 20,
        "transform.y": 30,
        "transform.rotate": 15,
        "transform.scaleX": 1.2,
        "transform.scaleY": 0.9,
      },
    }) as Layer;

    const layersBefore: Record<string, Layer> = { p: pLayer, c: cLayer };

    // World matrix before parenting
    const worldBefore = computeComposedWorldMatrix(layersBefore, "c");
    const testCorners: Array<[number, number]> = [[0, 0], [100, 0], [100, 100], [0, 100]];
    const worldCornersBefore = testCorners.map((pt) => applyAffineMatrix(worldBefore, pt));

    // Reparent C to P with pose preservation
    const newProps = computeReparentedLocalTransform(cLayer, "p", layersBefore, 100, 100);

    const cLayerAfter: Layer = {
      ...cLayer,
      parentRef: "p",
      properties: {
        ...cLayer.properties,
        ...newProps,
      },
    };

    const layersAfter: Record<string, Layer> = { p: pLayer, c: cLayerAfter };
    const worldAfter = computeComposedWorldMatrix(layersAfter, "c");
    const worldCornersAfter = testCorners.map((pt) => applyAffineMatrix(worldAfter, pt));

    // Every single corner must match in world space to within 0.05px
    for (let i = 0; i < 4; i++) {
      close(worldCornersAfter[i][0], worldCornersBefore[i][0], 0.05, `corner ${i} x`);
      close(worldCornersAfter[i][1], worldCornersBefore[i][1], 0.05, `corner ${i} y`);
    }
  });

  it("supports a helper layer parenting multiple child layers simultaneously", () => {
    const helperLayer = createLayer({
      id: "null1",
      archetype: "container",
      name: "Null Driver",
      properties: {
        "render.role": "helper",
        "frame.x": 0,
        "frame.y": 0,
        "transform.origin": "top left",
        "transform.x": 50,
        "transform.y": 50,
        "transform.rotate": 90,
      },
    }) as Layer;

    const child1 = createLayer({
      id: "ch1",
      archetype: "rectangle",
      parentRef: "null1",
      properties: {
        "frame.x": 10,
        "frame.y": 0,
        "transform.x": 0,
        "transform.y": 0,
      },
    }) as Layer;

    const child2 = createLayer({
      id: "ch2",
      archetype: "rectangle",
      parentRef: "null1",
      properties: {
        "frame.x": 0,
        "frame.y": 20,
        "transform.x": 0,
        "transform.y": 0,
      },
    }) as Layer;

    const layers: Record<string, Layer> = { null1: helperLayer, ch1: child1, ch2: child2 };

    const mCh1 = computeComposedWorldMatrix(layers, "ch1");
    const mCh2 = computeComposedWorldMatrix(layers, "ch2");

    // Both children rotate with the 90° rotation of the null helper
    const ptCh1 = applyAffineMatrix(mCh1, [0, 0]);
    const ptCh2 = applyAffineMatrix(mCh2, [0, 0]);

    // ch1 was at [10, 0], rotated 90° about [0, 0] => [0, 10], plus [50, 50] => [50, 60]
    close(ptCh1[0], 50, 1e-4);
    close(ptCh1[1], 60, 1e-4);

    // ch2 was at [0, 20], rotated 90° about [0, 0] => [-20, 0], plus [50, 50] => [30, 50]
    close(ptCh2[0], 30, 1e-4);
    close(ptCh2[1], 50, 1e-4);
  });

  it("Condition 1: layer.parentRef is the sole authoritative source of truth and cannot diverge from properties['transform.parent']", () => {
    // 1. When parentRef is set, getLayerParentRef authoritatively ignores any conflicting stale property
    const layerWithStaleProp = createLayer({
      id: "layer1",
      archetype: "rectangle",
      parentRef: "authoritative_parent",
      properties: {
        "transform.parent": "stale_divergent_parent",
      },
    }) as Layer;

    assert.equal(getLayerParentRef(layerWithStaleProp), "authoritative_parent");

    // 2. When parentRef is null (explicitly detached), stale property is ignored
    const detachedLayer = createLayer({
      id: "layer2",
      archetype: "rectangle",
      parentRef: null,
      properties: {
        "transform.parent": "stale_parent",
      },
    }) as Layer;

    assert.equal(getLayerParentRef(detachedLayer), null);

    // 3. Fallback only applies when parentRef is completely undefined (legacy object)
    const rawLegacyObject = {
      id: "legacy",
      archetype: "rectangle",
      properties: { "transform.parent": "legacy_parent" },
    };
    assert.equal(getLayerParentRef(rawLegacyObject as unknown as Layer), "legacy_parent");

    // 4. Store commands maintain projection synchronization
    useHistoryStore.getState().clearHistory();
    const p1 = createLayer({ id: "p1", archetype: "container" });
    const c1 = createLayer({ id: "c1", archetype: "rectangle" });
    setDocument(createDocumentFromLayers([p1, c1]));

    documentCommands.setTransformParent("c1", "p1");
    let current = getDocument().layers["c1"];
    assert.equal(current.parentRef, "p1");
    assert.equal(current.properties["transform.parent"], "p1");
    assert.equal(getLayerParentRef(current), "p1");

    // 5. updateProps targeting "transform.parent" synchronizes authoritative parentRef
    documentCommands.updateProps("c1", { "transform.parent": "" });
    current = getDocument().layers["c1"];
    assert.equal(current.parentRef, null);
    assert.equal(current.properties["transform.parent"], undefined);
    assert.equal(getLayerParentRef(current), null);
  });

  it("Condition 2: deleting a transformed parent with multiple children detaches children, preserves world transforms (< 0.05px), and supports undo/redo", () => {
    useHistoryStore.getState().clearHistory();

    // 1. Create a helper with rotation, nonuniform scale and translation
    const helper = createLayer({
      id: "helper_null",
      archetype: "container",
      name: "Transform Parent Null",
      properties: {
        "render.role": "helper",
        "frame.x": 100,
        "frame.y": 50,
        "transform.x": 30,
        "transform.y": 20,
        "transform.rotate": 30,
        "transform.scaleX": 1.5,
        "transform.scaleY": 0.8,
        "transform.origin": "top left",
      },
    });

    // 2. Attach at least two children
    const child1 = createLayer({
      id: "child1",
      archetype: "rectangle",
      name: "Child Layer 1",
      parentRef: "helper_null",
      properties: {
        "frame.x": 10,
        "frame.y": 10,
        "transform.x": 5,
        "transform.y": 5,
        "transform.scale": 1.2,
        "transform.origin": "top left",
      },
    });

    const child2 = createLayer({
      id: "child2",
      archetype: "rectangle",
      name: "Child Layer 2",
      parentRef: "helper_null",
      properties: {
        "frame.x": 40,
        "frame.y": 60,
        "transform.x": -10,
        "transform.y": 15,
        "transform.scale": 0.8,
        "transform.origin": "top left",
      },
    });

    setDocument(createDocumentFromLayers([helper, child1, child2]));

    // 3. Record all four world-space corners of each child before deletion
    const testCorners: Array<[number, number]> = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
    ];

    const initialDoc = getDocument();
    const c1_worldBefore = computeComposedWorldMatrix(initialDoc.layers, "child1");
    const c2_worldBefore = computeComposedWorldMatrix(initialDoc.layers, "child2");

    const c1_cornersBefore = testCorners.map((p) => applyAffineMatrix(c1_worldBefore, p));
    const c2_cornersBefore = testCorners.map((p) => applyAffineMatrix(c2_worldBefore, p));

    // 4. Delete the helper
    documentCommands.removeLayer("helper_null");

    const docAfterDelete = getDocument();

    // 5. Confirm that helper is gone and both children are detached
    assert.equal(docAfterDelete.layers["helper_null"], undefined, "Helper should be deleted");
    assert.equal(docAfterDelete.layers["child1"].parentRef, null, "Child 1 should be detached");
    assert.equal(docAfterDelete.layers["child2"].parentRef, null, "Child 2 should be detached");
    assert.equal(docAfterDelete.layers["child1"].properties["transform.parent"], undefined);
    assert.equal(docAfterDelete.layers["child2"].properties["transform.parent"], undefined);

    // 6. Confirm that their world-space corners remain unchanged (< 0.05px tolerance)
    const c1_worldAfter = computeComposedWorldMatrix(docAfterDelete.layers, "child1");
    const c2_worldAfter = computeComposedWorldMatrix(docAfterDelete.layers, "child2");

    const c1_cornersAfter = testCorners.map((p) => applyAffineMatrix(c1_worldAfter, p));
    const c2_cornersAfter = testCorners.map((p) => applyAffineMatrix(c2_worldAfter, p));

    for (let i = 0; i < 4; i++) {
      close(c1_cornersAfter[i][0], c1_cornersBefore[i][0], 0.05, `child1 corner ${i} x after delete`);
      close(c1_cornersAfter[i][1], c1_cornersBefore[i][1], 0.05, `child1 corner ${i} y after delete`);
      close(c2_cornersAfter[i][0], c2_cornersBefore[i][0], 0.05, `child2 corner ${i} x after delete`);
      close(c2_cornersAfter[i][1], c2_cornersBefore[i][1], 0.05, `child2 corner ${i} y after delete`);
    }

    // 7. Verify undo restores the helper and reparents children with identical corners
    historyCommands.undo();

    const docAfterUndo = getDocument();
    assert.ok(docAfterUndo.layers["helper_null"], "Helper should be restored after undo");
    assert.equal(docAfterUndo.layers["child1"].parentRef, "helper_null", "Child 1 re-parented on undo");
    assert.equal(docAfterUndo.layers["child2"].parentRef, "helper_null", "Child 2 re-parented on undo");

    const c1_worldUndo = computeComposedWorldMatrix(docAfterUndo.layers, "child1");
    const c2_worldUndo = computeComposedWorldMatrix(docAfterUndo.layers, "child2");
    const c1_cornersUndo = testCorners.map((p) => applyAffineMatrix(c1_worldUndo, p));
    const c2_cornersUndo = testCorners.map((p) => applyAffineMatrix(c2_worldUndo, p));

    for (let i = 0; i < 4; i++) {
      close(c1_cornersUndo[i][0], c1_cornersBefore[i][0], 0.05, `child1 corner ${i} x after undo`);
      close(c1_cornersUndo[i][1], c1_cornersBefore[i][1], 0.05, `child1 corner ${i} y after undo`);
      close(c2_cornersUndo[i][0], c2_cornersBefore[i][0], 0.05, `child2 corner ${i} x after undo`);
      close(c2_cornersUndo[i][1], c2_cornersBefore[i][1], 0.05, `child2 corner ${i} y after undo`);
    }

    // 8. Verify redo re-deletes helper and detaches children with identical corners
    historyCommands.redo();

    const docAfterRedo = getDocument();
    assert.equal(docAfterRedo.layers["helper_null"], undefined, "Helper should be deleted again after redo");
    assert.equal(docAfterRedo.layers["child1"].parentRef, null, "Child 1 detached after redo");
    assert.equal(docAfterRedo.layers["child2"].parentRef, null, "Child 2 detached after redo");

    const c1_worldRedo = computeComposedWorldMatrix(docAfterRedo.layers, "child1");
    const c2_worldRedo = computeComposedWorldMatrix(docAfterRedo.layers, "child2");
    const c1_cornersRedo = testCorners.map((p) => applyAffineMatrix(c1_worldRedo, p));
    const c2_cornersRedo = testCorners.map((p) => applyAffineMatrix(c2_worldRedo, p));

    for (let i = 0; i < 4; i++) {
      close(c1_cornersRedo[i][0], c1_cornersBefore[i][0], 0.05, `child1 corner ${i} x after redo`);
      close(c1_cornersRedo[i][1], c1_cornersBefore[i][1], 0.05, `child1 corner ${i} y after redo`);
      close(c2_cornersRedo[i][0], c2_cornersBefore[i][0], 0.05, `child2 corner ${i} x after redo`);
      close(c2_cornersRedo[i][1], c2_cornersBefore[i][1], 0.05, `child2 corner ${i} y after redo`);
    }
  });
});
