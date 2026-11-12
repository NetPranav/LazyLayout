import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT } from "../../../store/documentState";
import type { MotionDocument, Object3d } from "../../../document/schema";
import { worldMatrix } from "../../hierarchy";
import {
  buildOutliner,
  findNode,
  flattenVisible,
  pathIdsTo,
  pathTo,
} from "../tree";
import {
  createCollection,
  deleteNode,
  moveToCollection,
  renameNode,
  reparent,
  setFlag,
} from "../ops";

function assertAlmostEqual(actual: number, expected: number, tol = 1e-6, msg?: string): void {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${msg ? msg + ": " : ""}Expected ${actual} to be close to ${expected} within tol ${tol}`
  );
}

function assertMat4Close(actual: ArrayLike<number>, expected: ArrayLike<number>, tol = 1e-6, msg?: string): void {
  assert.strictEqual(actual.length, 16, "Matrix must have 16 elements");
  assert.strictEqual(expected.length, 16, "Matrix must have 16 elements");
  for (let i = 0; i < 16; i++) {
    assertAlmostEqual(actual[i], expected[i], tol, `${msg ?? "Matrix elem"} at index ${i}`);
  }
}

function makeObject(
  id: string,
  overrides: Partial<Object3d> = {}
): Object3d {
  return {
    id,
    name: overrides.name ?? id,
    type: overrides.type ?? "mesh",
    transform: overrides.transform ?? {
      location: [0, 0, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: overrides.visible ?? true,
    selectable: overrides.selectable ?? true,
    renderVisible: overrides.renderVisible ?? true,
    parentId: overrides.parentId ?? null,
    dataId: overrides.dataId ?? null,
    materialSlots: overrides.materialSlots,
    materials: overrides.materials,
    collection: overrides.collection,
    ...(overrides.parentInverse ? { parentInverse: overrides.parentInverse } : {}),
  };
}

describe("Phase 3D-021: Outliner tree model", () => {
  it("builds correct tree shape for a nested scene with collections and leaf data", () => {
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_main: {
          id: "scn_main",
          name: "Main Scene",
          objects: ["obj_sun", "obj_tree", "obj_apple", "obj_crate", "obj_ground"],
          collections: {
            col_env: {
              id: "col_env",
              name: "Environment",
              parent: null,
              visible: true,
            },
            col_foliage: {
              id: "col_foliage",
              name: "Foliage",
              parent: "col_env",
              visible: true,
            },
            col_props: {
              id: "col_props",
              name: "Props",
              parent: null,
              visible: true,
            },
          },
        },
      },
      objects: {
        obj_sun: makeObject("obj_sun", {
          name: "Sun Light",
          type: "light",
          collection: "col_env",
          dataId: "lit_sun",
        }),
        obj_tree: makeObject("obj_tree", {
          name: "Oak Tree",
          type: "mesh",
          collection: "col_foliage",
          dataId: "msh_tree",
          materialSlots: ["mat_bark", "mat_leaf"],
        }),
        obj_apple: makeObject("obj_apple", {
          name: "Apple",
          type: "mesh",
          collection: "col_foliage",
          parentId: "obj_tree",
          dataId: "msh_apple",
        }),
        obj_crate: makeObject("obj_crate", {
          name: "Wood Crate",
          type: "mesh",
          collection: "col_props",
          dataId: "msh_crate",
        }),
        obj_ground: makeObject("obj_ground", {
          name: "Ground Plane",
          type: "mesh",
          dataId: "msh_ground",
        }),
      },
      meshes: {
        msh_tree: { id: "msh_tree", name: "TreeMesh" },
        msh_apple: { id: "msh_apple", name: "AppleMesh" },
        msh_crate: { id: "msh_crate", name: "CrateMesh" },
        msh_ground: { id: "msh_ground", name: "GroundMesh" },
      },
      lights: {
        lit_sun: { id: "lit_sun", name: "SunLightData", type: "directional", color: "#ffffff", intensity: 1 },
      },
      materials: {
        mat_bark: { id: "mat_bark", name: "BarkMaterial" } as never,
        mat_leaf: { id: "mat_leaf", name: "LeafMaterial" } as never,
      },
    };

    // Attach a modifier defensively to obj_tree
    (doc.objects!.obj_tree as Record<string, unknown>).modifiers = [
      { id: "mod_wind", type: "wave", name: "WindWave" },
    ];

    const tree = buildOutliner(doc, "scn_main");

    // Root nodes: col_env, col_props, obj_ground
    assert.strictEqual(tree.length, 3);
    assert.strictEqual(tree[0].id, "col_env");
    assert.strictEqual(tree[0].kind, "collection");
    assert.strictEqual(tree[0].depth, 0);

    assert.strictEqual(tree[1].id, "col_props");
    assert.strictEqual(tree[1].kind, "collection");
    assert.strictEqual(tree[1].depth, 0);

    assert.strictEqual(tree[2].id, "obj_ground");
    assert.strictEqual(tree[2].kind, "object");
    assert.strictEqual(tree[2].depth, 0);

    // Inside col_env: col_foliage (nested collection) and obj_sun
    const colEnv = tree[0];
    assert.strictEqual(colEnv.children.length, 2);
    assert.strictEqual(colEnv.children[0].id, "col_foliage");
    assert.strictEqual(colEnv.children[0].kind, "collection");
    assert.strictEqual(colEnv.children[0].depth, 1);
    assert.strictEqual(colEnv.children[1].id, "obj_sun");
    assert.strictEqual(colEnv.children[1].kind, "object");

    // Inside col_foliage: obj_tree
    const colFoliage = colEnv.children[0];
    assert.strictEqual(colFoliage.children.length, 1);
    const treeObjNode = colFoliage.children[0];
    assert.strictEqual(treeObjNode.id, "obj_tree");
    assert.strictEqual(treeObjNode.label, "Oak Tree");

    // Inside obj_tree: leaf data (msh_tree), material slots (mat_bark, mat_leaf), modifier (mod_wind), and child object (obj_apple)
    assert.strictEqual(treeObjNode.children.length, 5);
    assert.strictEqual(treeObjNode.children[0].id, "msh_tree");
    assert.strictEqual(treeObjNode.children[0].kind, "data");
    assert.strictEqual(treeObjNode.children[0].label, "TreeMesh");

    assert.strictEqual(treeObjNode.children[1].id, "mat_bark");
    assert.strictEqual(treeObjNode.children[1].kind, "material");
    assert.strictEqual(treeObjNode.children[1].label, "BarkMaterial");

    assert.strictEqual(treeObjNode.children[2].id, "mat_leaf");
    assert.strictEqual(treeObjNode.children[2].kind, "material");

    assert.strictEqual(treeObjNode.children[3].id, "mod_wind");
    assert.strictEqual(treeObjNode.children[3].kind, "modifier");
    assert.strictEqual(treeObjNode.children[3].label, "WindWave");

    assert.strictEqual(treeObjNode.children[4].id, "obj_apple");
    assert.strictEqual(treeObjNode.children[4].kind, "object");

    // Test findNode
    const foundApple = findNode(tree, "obj_apple");
    assert.ok(foundApple);
    assert.strictEqual(foundApple.label, "Apple");

    const foundMat = findNode(tree, "mat_leaf");
    assert.ok(foundMat);
    assert.strictEqual(foundMat.kind, "material");

    // Test pathTo and pathIdsTo
    const applePathIds = pathIdsTo(tree, "obj_apple");
    assert.deepStrictEqual(applePathIds, [
      "col_env",
      "col_foliage",
      "obj_tree",
      "obj_apple",
    ]);

    const leafPath = pathTo(tree, "mat_leaf");
    assert.ok(leafPath);
    assert.strictEqual(leafPath.length, 4);
    assert.strictEqual(leafPath[0].id, "col_env");
    assert.strictEqual(leafPath[1].id, "col_foliage");
    assert.strictEqual(leafPath[2].id, "obj_tree");
    assert.strictEqual(leafPath[3].id, "mat_leaf");

    // Test flattenVisible
    // When only col_env and col_foliage are expanded
    const flat1 = flattenVisible(tree, ["col_env", "col_foliage"]);
    const flat1Ids = flat1.map((n) => n.id);
    assert.ok(flat1Ids.includes("col_env"));
    assert.ok(flat1Ids.includes("col_foliage"));
    assert.ok(flat1Ids.includes("obj_sun"));
    assert.ok(flat1Ids.includes("obj_tree"));
    assert.ok(!flat1Ids.includes("obj_apple")); // tree not expanded yet

    // When obj_tree is also expanded
    const flat2 = flattenVisible(tree, ["col_env", "col_foliage", "obj_tree"]);
    const flat2Ids = flat2.map((n) => n.id);
    assert.ok(flat2Ids.includes("obj_apple"));
    assert.ok(flat2Ids.includes("msh_tree"));
    assert.ok(flat2Ids.includes("mat_bark"));
    assert.ok(flat2Ids.includes("mat_leaf"));
    assert.ok(flat2Ids.includes("mod_wind"));
  });

  it("golden world matrices before/after reparent through 4-level hierarchies (1e-6)", () => {
    // 4-level hierarchy: Root -> L1 -> L2 -> L3
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: {
          id: "scn_test",
          objects: ["root", "node_l1", "node_l2", "node_l3"],
        },
      },
      objects: {
        root: makeObject("root", {
          transform: {
            location: [10, 0, -5],
            rotationQuat: [0, 0.3826834, 0, 0.9238795], // 45 deg around Y
            scale: [2, 2, 2],
          },
        }),
        node_l1: makeObject("node_l1", {
          parentId: "root",
          transform: {
            location: [1, 2, 3],
            rotationQuat: [0.7071068, 0, 0, 0.7071068], // 90 deg around X
            scale: [1, 1, 1],
          },
        }),
        node_l2: makeObject("node_l2", {
          parentId: "node_l1",
          transform: {
            location: [0, 5, 0],
            rotationQuat: [0, 0, 0.3826834, 0.9238795], // 45 deg around Z
            scale: [0.5, 0.5, 0.5],
          },
        }),
        node_l3: makeObject("node_l3", {
          parentId: "node_l2",
          transform: {
            location: [2, 0, -1],
            rotationQuat: [0.270598, 0.270598, 0.653281, 0.653281],
            scale: [1, 1, 1],
          },
        }),
      },
    };

    // Calculate golden world matrices before reparenting
    const wRootBefore = worldMatrix(doc, "root");
    const wL1Before = worldMatrix(doc, "node_l1");
    const wL2Before = worldMatrix(doc, "node_l2");
    const wL3Before = worldMatrix(doc, "node_l3");

    // Case 1: Reparent leaf node_l3 to root directly
    const docReparentToRoot = reparent(doc, "node_l3", "root");
    assert.strictEqual(docReparentToRoot.objects!.node_l3.parentId, "root");
    const wL3After1 = worldMatrix(docReparentToRoot, "node_l3");
    assertMat4Close(wL3After1, wL3Before, 1e-6, "node_l3 reparented to root");

    // Verify other objects were untouched in docReparentToRoot
    assertMat4Close(worldMatrix(docReparentToRoot, "root"), wRootBefore, 1e-6);
    assertMat4Close(worldMatrix(docReparentToRoot, "node_l1"), wL1Before, 1e-6);
    assertMat4Close(worldMatrix(docReparentToRoot, "node_l2"), wL2Before, 1e-6);

    // Case 2: Reparent leaf node_l3 to null (scene root)
    const docUnparentL3 = reparent(doc, "node_l3", null);
    assert.strictEqual(docUnparentL3.objects!.node_l3.parentId, null);
    const wL3After2 = worldMatrix(docUnparentL3, "node_l3");
    assertMat4Close(wL3After2, wL3Before, 1e-6, "node_l3 unparented to null (scene root)");

    // Case 3: Reparent mid-level node_l2 to root (moving node_l3 along with it)
    const docReparentL2 = reparent(doc, "node_l2", "root");
    assert.strictEqual(docReparentL2.objects!.node_l2.parentId, "root");
    const wL2After = worldMatrix(docReparentL2, "node_l2");
    const wL3After3 = worldMatrix(docReparentL2, "node_l3");
    assertMat4Close(wL2After, wL2Before, 1e-6, "node_l2 reparented to root");
    assertMat4Close(wL3After3, wL3Before, 1e-6, "node_l3 kept world position when its parent moved");

    // Case 4: Original document was NOT mutated (immutability check)
    assert.strictEqual(doc.objects!.node_l3.parentId, "node_l2");
    assert.strictEqual(doc.objects!.node_l2.parentId, "node_l1");
  });

  it("refuses parenting cycles with a clear error", () => {
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: { scn_test: { id: "scn_test", objects: ["A", "B", "C", "D"] } },
      objects: {
        A: makeObject("A"),
        B: makeObject("B", { parentId: "A" }),
        C: makeObject("C", { parentId: "B" }),
        D: makeObject("D", { parentId: "C" }),
      },
    };

    // 1. Self-parenting
    assert.throws(
      () => reparent(doc, "A", "A"),
      /Cannot parent object "A" to itself/
    );

    // 2. Direct child (parenting A under B)
    assert.throws(
      () => reparent(doc, "A", "B"),
      /Cannot parent object "A" under its own descendant "B"/
    );

    // 3. Deep descendant (parenting A under D)
    assert.throws(
      () => reparent(doc, "A", "D"),
      /Cannot parent object "A" under its own descendant "D"/
    );

    // 4. Intermediate descendant (parenting B under D)
    assert.throws(
      () => reparent(doc, "B", "D"),
      /Cannot parent object "B" under its own descendant "D"/
    );
  });

  it("handles flags and effective visibility for collections and objects", () => {
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: {
          id: "scn_test",
          objects: ["obj_inside", "obj_outside"],
          collections: {
            col_folder: {
              id: "col_folder",
              name: "Folder",
              visible: true,
              selectable: true,
              renderVisible: true,
            },
          },
        },
      },
      objects: {
        obj_inside: makeObject("obj_inside", {
          collection: "col_folder",
          visible: true,
          selectable: true,
          renderVisible: true,
        }),
        obj_outside: makeObject("obj_outside", {
          visible: true,
          selectable: true,
          renderVisible: true,
        }),
      },
    };

    // 1. Initially everything visible
    const tree1 = buildOutliner(doc, "scn_test");
    const nodeInside1 = findNode(tree1, "obj_inside");
    assert.strictEqual(nodeInside1?.flags.visible, true);

    // 2. Hide collection via setFlag
    const docHidden = setFlag(doc, "col_folder", "visible", false);
    assert.strictEqual(docHidden.scenes!.scn_test.collections!.col_folder.visible, false);
    // Stored flag on object inside stays true
    assert.strictEqual(docHidden.objects!.obj_inside.visible, true);

    // 3. Built tree reflects effective hidden visibility
    const treeHidden = buildOutliner(docHidden, "scn_test");
    const colNode = findNode(treeHidden, "col_folder");
    const nodeInsideHidden = findNode(treeHidden, "obj_inside");
    const nodeOutside = findNode(treeHidden, "obj_outside");

    assert.strictEqual(colNode?.flags.visible, false);
    assert.strictEqual(nodeInsideHidden?.flags.visible, false, "Object in hidden collection is hidden for display");
    assert.strictEqual(nodeInsideHidden?.storedFlags?.visible, true, "Stored flag stays true");
    assert.strictEqual(nodeOutside?.flags.visible, true, "Object outside collection remains visible");

    // 4. Toggling selectable and renderVisible flags
    const docUnselectable = setFlag(docHidden, "col_folder", "selectable", false);
    const treeUnselectable = buildOutliner(docUnselectable, "scn_test");
    assert.strictEqual(findNode(treeUnselectable, "obj_inside")?.flags.selectable, false);
    assert.strictEqual(findNode(treeUnselectable, "obj_outside")?.flags.selectable, true);
  });

  it("the tree mirrors the document both ways under ops (apply op, rebuild, compare)", () => {
    let doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: {
          id: "scn_test",
          objects: ["box_1", "box_2"],
        },
      },
      objects: {
        box_1: makeObject("box_1", { name: "Box 1" }),
        box_2: makeObject("box_2", { name: "Box 2" }),
      },
    };

    // 1. Initial state
    let tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(tree.length, 2);
    assert.strictEqual(tree[0].id, "box_1");
    assert.strictEqual(tree[1].id, "box_2");

    // 2. Create collection
    doc = createCollection(doc, "scn_test", { id: "col_crates", name: "Crates" });
    tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(tree.length, 3);
    assert.ok(findNode(tree, "col_crates"));

    // 3. Move box_1 to collection
    doc = moveToCollection(doc, "box_1", "col_crates");
    tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(tree.length, 2); // col_crates and box_2 at root
    const colNode = findNode(tree, "col_crates");
    assert.strictEqual(colNode?.children.length, 1);
    assert.strictEqual(colNode?.children[0].id, "box_1");

    // 4. Reparent box_2 under box_1
    doc = reparent(doc, "box_2", "box_1");
    tree = buildOutliner(doc, "scn_test");
    const box1Node = findNode(tree, "box_1");
    assert.ok(box1Node?.children.some((c) => c.id === "box_2"));

    // 5. Rename box_1
    doc = renameNode(doc, "box_1", "Heavy Crate");
    tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(findNode(tree, "box_1")?.label, "Heavy Crate");

    // 6. Delete collection (box_1 is unlinked, remains in scene)
    doc = deleteNode(doc, "col_crates");
    tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(findNode(tree, "col_crates"), null);
    assert.ok(findNode(tree, "box_1"));

    // 7. Delete object box_1
    doc = deleteNode(doc, "box_1");
    tree = buildOutliner(doc, "scn_test");
    assert.strictEqual(findNode(tree, "box_1"), null);
  });
});
