import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT } from "@/core/store/documentState";
import type { MotionDocument, Scene3d, Object3d, Mesh3d, Material3d } from "@/core/document/schema";
import {
  buildOutliner,
  flattenVisible,
  findNode,
  type OutlinerNode,
} from "@/core/3d/outliner/tree";
import {
  setFlag,
  reparent,
  moveToCollection,
  renameNode,
  deleteNode,
} from "@/core/3d/outliner/ops";
import { userCounts } from "@/core/3d/blocks/userCounts";
import { copyAttributes } from "@/core/3d/blocks/copyAttributes";
import { makeSingleUser } from "@/core/document/dataBlocks";
import { click, EMPTY_SELECTION } from "@/core/3d/pick/select";
import { worldMatrix } from "@/core/3d/hierarchy";

function floatEqual(a: number, b: number, tol = 1e-4): boolean {
  return Math.abs(a - b) <= tol;
}

function createSampleDocument(): MotionDocument {
  const cubeMesh: Mesh3d = {
    id: "msh_cube",
    name: "CubeMesh",
    positions: [0, 0, 0, 1, 0, 0, 1, 1, 0],
    indices: [0, 1, 2],
  };

  const sharedMat: Material3d = {
    id: "mat_shared",
    name: "SharedMaterial",
    emissive: "#000000",
    baseColor: "#ff0000",
    metallic: 0.1,
    roughness: 0.5,
  };

  const objCube: Object3d = {
    id: "obj_cube",
    name: "Cube",
    type: "mesh",
    dataId: "msh_cube",
    materials: ["mat_shared"],
    materialSlots: ["mat_shared"],
    transform: {
      location: [0, 1, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
    selectable: true,
    renderVisible: true,
  };

  const objSphere: Object3d = {
    id: "obj_sphere",
    name: "Sphere",
    type: "mesh",
    dataId: "msh_cube", // shared mesh
    materials: ["mat_shared"], // shared material
    materialSlots: ["mat_shared"],
    transform: {
      location: [5, 2, 0],
      rotationQuat: [0, 0, 0, 1],
      scale: [1, 1, 1],
    },
    visible: true,
    selectable: true,
    renderVisible: true,
  };

  const scene: Scene3d = {
    id: "scn_main",
    name: "Main Scene",
    activeCamera: null,
    world: null,
    objects: ["obj_cube", "obj_sphere"],
    collections: {
      col_props: {
        id: "col_props",
        name: "Props",
        visible: true,
        selectable: true,
        renderVisible: true,
        parent: null,
      },
    },
  };

  return {
    ...DEFAULT_DOCUMENT,
    schemaVersion: 7,
    scenes: {
      scn_main: scene,
    },
    objects: {
      obj_cube: objCube,
      obj_sphere: objSphere,
    },
    meshes: {
      msh_cube: cubeMesh,
    },
    materials: {
      mat_shared: sharedMat,
    },
    layers: {},
  };
}

describe("Outliner3d Pure Model & Helpers", () => {
  it("builds the outliner tree structure with collections, objects, data blocks, and materials", () => {
    const doc = createSampleDocument();
    const tree = buildOutliner(doc, "scn_main");

    assert.equal(tree.length, 3); // 1 collection ("Props") + 2 root objects ("Cube", "Sphere")

    const cubeNode = tree.find((n) => n.id === "obj_cube");
    assert.ok(cubeNode);
    assert.equal(cubeNode.kind, "object");
    assert.equal(cubeNode.label, "Cube");

    // Children of Cube: data block and material slot
    const dataChild = cubeNode.children.find((c) => c.kind === "data");
    assert.ok(dataChild);
    assert.equal(dataChild.dataId, "msh_cube");
    assert.equal(dataChild.label, "CubeMesh");

    const matChild = cubeNode.children.find((c) => c.kind === "material");
    assert.ok(matChild);
    assert.equal(matChild.id, "mat_shared");
    assert.equal(matChild.label, "SharedMaterial");
  });

  it("flattens visible nodes depending on expansion state", () => {
    const doc = createSampleDocument();
    const tree = buildOutliner(doc, "scn_main");

    // Collapsed: only root nodes visible
    const collapsedVisible = flattenVisible(tree, new Set());
    assert.equal(collapsedVisible.length, 3);

    // Expand cube: cube's children become visible
    const expandedVisible = flattenVisible(tree, new Set(["obj_cube"]));
    assert.equal(expandedVisible.length, 5); // 3 root + 2 kids
  });

  it("calculates accurate user counts for shared meshes and materials", () => {
    const doc = createSampleDocument();
    const counts = userCounts(doc);

    // Both obj_cube and obj_sphere reference msh_cube
    assert.equal(counts.meshes.msh_cube, 2);
    // Both obj_cube and obj_sphere reference mat_shared
    assert.equal(counts.materials.mat_shared, 2);
  });

  it("splits a shared block into single-user copy", () => {
    const doc = createSampleDocument();
    const nextDoc = makeSingleUser(doc, "obj_sphere", "mesh");

    // obj_sphere now points to a unique mesh data block
    const newMeshId = nextDoc.objects!.obj_sphere.dataId;
    assert.notEqual(newMeshId, "msh_cube");
    assert.ok(newMeshId && nextDoc.meshes![newMeshId]);

    // Recalculate counts: msh_cube now only has 1 user
    const countsAfter = userCounts(nextDoc);
    assert.equal(countsAfter.meshes.msh_cube, 1);
    assert.equal(countsAfter.meshes[newMeshId!], 1);
  });

  it("toggles flags (visible, selectable, renderVisible) via setFlag", () => {
    const doc = createSampleDocument();

    const hiddenDoc = setFlag(doc, "obj_cube", "visible", false);
    assert.equal(hiddenDoc.objects!.obj_cube.visible, false);

    const unselectableDoc = setFlag(hiddenDoc, "obj_cube", "selectable", false);
    assert.equal(unselectableDoc.objects!.obj_cube.selectable, false);

    const unrenderedDoc = setFlag(unselectableDoc, "obj_cube", "renderVisible", false);
    assert.equal(unrenderedDoc.objects!.obj_cube.renderVisible, false);

    // Tree reflects effective flags
    const tree = buildOutliner(unrenderedDoc, "scn_main");
    const node = findNode(tree, "obj_cube") as OutlinerNode;
    assert.equal(node.flags.visible, false);
    assert.equal(node.flags.selectable, false);
    assert.equal(node.flags.renderVisible, false);
  });

  it("reparents objects while strictly preserving world transforms", () => {
    const doc = createSampleDocument();

    // World transform of obj_sphere before parenting
    const worldBefore = worldMatrix(doc, "obj_sphere");
    const posBeforeX = worldBefore[12];
    const posBeforeY = worldBefore[13];
    const posBeforeZ = worldBefore[14];

    // Reparent obj_sphere under obj_cube
    const reparentedDoc = reparent(doc, "obj_sphere", "obj_cube");
    assert.equal(reparentedDoc.objects!.obj_sphere.parentId, "obj_cube");

    // World transform of obj_sphere after parenting
    const worldAfter = worldMatrix(reparentedDoc, "obj_sphere");
    assert.ok(floatEqual(worldAfter[12], posBeforeX));
    assert.ok(floatEqual(worldAfter[13], posBeforeY));
    assert.ok(floatEqual(worldAfter[14], posBeforeZ));
  });

  it("moves object to collection and unlinks it cleanly", () => {
    const doc = createSampleDocument();

    const inColDoc = moveToCollection(doc, "obj_cube", "col_props");
    assert.equal(inColDoc.objects!.obj_cube.collection, "col_props");

    const outColDoc = moveToCollection(inColDoc, "obj_cube", null);
    assert.equal(outColDoc.objects!.obj_cube.collection, undefined);
  });

  it("renames and deletes nodes", () => {
    const doc = createSampleDocument();

    const renamedDoc = renameNode(doc, "obj_cube", "GiantCube");
    assert.equal(renamedDoc.objects!.obj_cube.name, "GiantCube");

    const deletedDoc = deleteNode(renamedDoc, "obj_cube");
    assert.equal(deletedDoc.objects!.obj_cube, undefined);
    assert.equal(deletedDoc.scenes!.scn_main.objects.includes("obj_cube"), false);
  });

  it("copies attributes between objects", () => {
    const doc = createSampleDocument();

    // Modify cube visibility and location
    const modCubeDoc = {
      ...doc,
      objects: {
        ...doc.objects,
        obj_cube: {
          ...doc.objects!.obj_cube,
          visible: false,
          transform: {
            ...doc.objects!.obj_cube.transform,
            location: [10, 20, 30] as [number, number, number],
          },
        },
      },
    };

    // Copy transform and visibility to obj_sphere
    const copiedDoc = copyAttributes(modCubeDoc, "obj_cube", ["obj_sphere"], [
      "transform",
      "visibility",
    ]);

    const sphereTransform = copiedDoc.objects!.obj_sphere.transform;
    assert.equal(sphereTransform.location[0], 10);
    assert.equal(sphereTransform.location[1], 20);
    assert.equal(sphereTransform.location[2], 30);
    assert.equal(copiedDoc.objects!.obj_sphere.visible, false);
  });

  it("updates selection with click reducer supporting Shift and Ctrl toggles", () => {
    // 1. Initial click
    const sel1 = click(EMPTY_SELECTION, "obj_cube");
    assert.equal(sel1.active, "obj_cube");
    assert.deepEqual(Array.from(sel1.selected), ["obj_cube"]);

    // 2. Shift+click another object (adds to selection)
    const sel2 = click(sel1, "obj_sphere", { shift: true });
    assert.equal(sel2.active, "obj_sphere");
    assert.equal(sel2.selected.length, 2);
    assert.ok(sel2.selected.includes("obj_cube"));
    assert.ok(sel2.selected.includes("obj_sphere"));

    // 3. Ctrl+click removes obj_cube
    const sel3 = click(sel2, "obj_cube", { ctrl: true });
    assert.deepEqual(Array.from(sel3.selected), ["obj_sphere"]);
    assert.equal(sel3.active, "obj_sphere");

    // 4. Background click without shift clears selection
    const sel4 = click(sel3, null);
    assert.deepEqual(Array.from(sel4.selected), []);
    assert.equal(sel4.active, null);
  });
});
