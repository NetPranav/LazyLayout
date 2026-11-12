import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT, setDocument } from "../../../store/documentState";
import { getDocument, historyCommands } from "../../../store/useDocumentStore";
import { useHistoryStore } from "../../../store/useHistoryStore";
import { tryRunCommand } from "../../../commands/registry";
import type { Material3d, Mesh3d, MotionDocument, Object3d } from "../../../document/schema";
import { makeSingleUser, userCount } from "../../../document/dataBlocks";
import { createId } from "../../../ids";
import { userCounts } from "../userCounts";
import { copyAttributes } from "../copyAttributes";
import { register3dBlocksCommands } from "../commands";
import { register3dOutlinerCommands } from "../../outliner/commands";

function createRng(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function bruteForceRecount(doc: MotionDocument) {
  const table = {
    materials: {} as Record<string, number>,
    meshes: {} as Record<string, number>,
    lights: {} as Record<string, number>,
    cameras: {} as Record<string, number>,
    armatures: {} as Record<string, number>,
    actions: {} as Record<string, number>,
    worlds: {} as Record<string, number>,
    images3d: {} as Record<string, number>,
    objects: {} as Record<string, number>,
    scenes: {} as Record<string, number>,
  };

  if (doc.materials) for (const id of Object.keys(doc.materials)) table.materials[id] = userCount(doc, "material", id);
  if (doc.meshes) for (const id of Object.keys(doc.meshes)) table.meshes[id] = userCount(doc, "mesh", id);
  if (doc.lights) for (const id of Object.keys(doc.lights)) table.lights[id] = userCount(doc, "light", id);
  if (doc.cameras) for (const id of Object.keys(doc.cameras)) table.cameras[id] = userCount(doc, "camera", id);
  if (doc.armatures) for (const id of Object.keys(doc.armatures)) table.armatures[id] = userCount(doc, "armature", id);
  if (doc.actions) for (const id of Object.keys(doc.actions)) table.actions[id] = userCount(doc, "action", id);
  if (doc.worlds) for (const id of Object.keys(doc.worlds)) table.worlds[id] = userCount(doc, "world", id);
  if (doc.images3d) for (const id of Object.keys(doc.images3d)) table.images3d[id] = userCount(doc, "image3d", id);
  if (doc.objects) for (const id of Object.keys(doc.objects)) table.objects[id] = userCount(doc, "object", id);
  if (doc.scenes) for (const id of Object.keys(doc.scenes)) table.scenes[id] = userCount(doc, "scene", id);

  return table;
}

function makeObject(id: string, overrides: Partial<Object3d> = {}): Object3d {
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
  };
}

describe("Phase 3D-024: Shared data blocks & copy attributes", () => {
  it("copyAttributes copies materials (+1 user count), clones modifiers with fresh ids, copies transform TRS, and copies visibility", () => {
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: {
          id: "scn_test",
          objects: ["src_obj", "dst_1", "dst_2"],
        },
      },
      materials: {
        mat_chrome: { id: "mat_chrome", name: "Chrome", metallic: 1 } as never,
      },
      objects: {
        src_obj: makeObject("src_obj", {
          materialSlots: ["mat_chrome"],
          transform: {
            location: [5, 10, 15],
            rotationQuat: [0, 0.7071068, 0, 0.7071068],
            scale: [2, 3, 4],
          },
          visible: false,
          selectable: false,
          renderVisible: true,
        }),
        dst_1: makeObject("dst_1", {
          materialSlots: [],
          transform: {
            location: [0, 0, 0],
            rotationQuat: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          visible: true,
          selectable: true,
          renderVisible: false,
        }),
        dst_2: makeObject("dst_2", {
          materialSlots: [],
        }),
      },
    };

    // Attach modifiers to src_obj
    (doc.objects!.src_obj as Record<string, unknown>).modifiers = [
      { id: "mod_bevel_1", type: "bevel", width: 0.1 },
      { id: "mod_subsurf_1", type: "subdivision", levels: 2 },
    ];

    // Initial user count of mat_chrome is 1 (only src_obj)
    assert.strictEqual(userCounts(doc).materials.mat_chrome, 1);

    // Copy all attributes from src_obj to [dst_1, dst_2]
    const updated = copyAttributes(
      doc,
      "src_obj",
      ["dst_1", "dst_2"],
      ["material", "modifiers", "transform", "visibility"]
    );

    // 1. Material sharing
    assert.deepStrictEqual(updated.objects!.dst_1.materialSlots, ["mat_chrome"]);
    assert.deepStrictEqual(updated.objects!.dst_2.materialSlots, ["mat_chrome"]);
    // User count of mat_chrome is now 3 (src_obj, dst_1, dst_2)
    assert.strictEqual(userCounts(updated).materials.mat_chrome, 3);

    // 2. Modifiers: cloned with new IDs
    const srcMods = (updated.objects!.src_obj as Record<string, unknown>).modifiers as Array<{ id: string; type: string }>;
    const dst1Mods = (updated.objects!.dst_1 as Record<string, unknown>).modifiers as Array<{ id: string; type: string }>;
    const dst2Mods = (updated.objects!.dst_2 as Record<string, unknown>).modifiers as Array<{ id: string; type: string }>;

    assert.strictEqual(dst1Mods.length, 2);
    assert.strictEqual(dst2Mods.length, 2);
    assert.strictEqual(dst1Mods[0].type, "bevel");
    assert.strictEqual(dst1Mods[1].type, "subdivision");

    // IDs must be newly generated and distinct from source and each other
    assert.notStrictEqual(dst1Mods[0].id, srcMods[0].id);
    assert.notStrictEqual(dst2Mods[0].id, srcMods[0].id);
    assert.notStrictEqual(dst1Mods[0].id, dst2Mods[0].id);

    // 3. Transform: TRS copied
    assert.deepStrictEqual(updated.objects!.dst_1.transform.location, [5, 10, 15]);
    assert.deepStrictEqual(updated.objects!.dst_1.transform.rotationQuat, [0, 0.7071068, 0, 0.7071068]);
    assert.deepStrictEqual(updated.objects!.dst_1.transform.scale, [2, 3, 4]);

    // 4. Visibility flags copied
    assert.strictEqual(updated.objects!.dst_1.visible, false);
    assert.strictEqual(updated.objects!.dst_1.selectable, false);
    assert.strictEqual(updated.objects!.dst_1.renderVisible, true);
  });

  it("makeSingleUser splits shared materials, meshes, and actions", () => {
    const doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: { id: "scn_test", objects: ["obj_a", "obj_b"] },
      },
      meshes: {
        msh_shared: { id: "msh_shared", name: "SharedMesh" },
      },
      materials: {
        mat_shared: { id: "mat_shared", name: "SharedMat" } as never,
      },
      actions: {
        act_shared: { id: "act_shared", name: "SharedAction" } as never,
      },
      objects: {
        obj_a: makeObject("obj_a", {
          dataId: "msh_shared",
          materialSlots: ["mat_shared"],
        }),
        obj_b: makeObject("obj_b", {
          dataId: "msh_shared",
          materialSlots: ["mat_shared"],
        }),
      },
    };

    (doc.objects!.obj_a as Record<string, unknown>).actionId = "act_shared";
    (doc.objects!.obj_b as Record<string, unknown>).actionId = "act_shared";

    // Initial counts: 2 users each
    const counts0 = userCounts(doc);
    assert.strictEqual(counts0.materials.mat_shared, 2);
    assert.strictEqual(counts0.meshes.msh_shared, 2);
    assert.strictEqual(counts0.actions.act_shared, 2);

    // 1. makeSingleUser for material on obj_b
    const docMatSplit = makeSingleUser(doc, "obj_b", { kind: "material", slot: 0 });
    const counts1 = userCounts(docMatSplit);
    assert.strictEqual(counts1.materials.mat_shared, 1);
    const newMatId = docMatSplit.objects!.obj_b.materialSlots![0];
    assert.notStrictEqual(newMatId, "mat_shared");
    assert.strictEqual(counts1.materials[newMatId], 1);

    // 2. makeSingleUser for mesh on obj_b
    const docMeshSplit = makeSingleUser(doc, "obj_b", "mesh");
    const counts2 = userCounts(docMeshSplit);
    assert.strictEqual(counts2.meshes.msh_shared, 1);
    const newMeshId = docMeshSplit.objects!.obj_b.dataId!;
    assert.notStrictEqual(newMeshId, "msh_shared");
    assert.strictEqual(counts2.meshes[newMeshId], 1);

    // 3. makeSingleUser for action on obj_b
    const docActionSplit = makeSingleUser(doc, "obj_b", "action");
    const counts3 = userCounts(docActionSplit);
    assert.strictEqual(counts3.actions.act_shared, 1);
    const newActId = (docActionSplit.objects!.obj_b as Record<string, unknown>).actionId as string;
    assert.notStrictEqual(newActId, "act_shared");
    assert.strictEqual(counts3.actions[newActId], 1);
  });

  it("user counts exact under 200 random operations compared with brute-force recount", () => {
    const rng = createRng(421024);

    let doc: MotionDocument = {
      ...structuredClone(DEFAULT_DOCUMENT),
      scenes: {
        scn_test: {
          id: "scn_test",
          objects: ["obj_0", "obj_1", "obj_2", "obj_3"],
        },
      },
      materials: {
        mat_0: { id: "mat_0", name: "Mat0" } as never,
        mat_1: { id: "mat_1", name: "Mat1" } as never,
        mat_2: { id: "mat_2", name: "Mat2" } as never,
      },
      meshes: {
        msh_0: { id: "msh_0", name: "Mesh0" },
        msh_1: { id: "msh_1", name: "Mesh1" },
      },
      lights: {
        lit_0: { id: "lit_0", name: "Light0", type: "point", color: "#ffffff", intensity: 10 },
      },
      cameras: {
        cam_0: { id: "cam_0", name: "Cam0", type: "perspective", fov: 50, near: 0.1, far: 100 },
      },
      armatures: {},
      actions: {
        act_0: { id: "act_0", name: "Action0" } as never,
      },
      worlds: {},
      images3d: {},
      objects: {
        obj_0: makeObject("obj_0", { dataId: "msh_0", materialSlots: ["mat_0"] }),
        obj_1: makeObject("obj_1", { dataId: "msh_0", materialSlots: ["mat_0", "mat_1"] }),
        obj_2: makeObject("obj_2", { dataId: "msh_1", materialSlots: ["mat_1"] }),
        obj_3: makeObject("obj_3", { type: "light", dataId: "lit_0" }),
      },
    };

    let nextObjNum = 4;
    const nextMatNum = 3;

    // Run 200 pseudo-random operations
    for (let step = 0; step < 200; step++) {
      const opChoice = Math.floor(rng() * 5);
      const objIds = Object.keys(doc.objects ?? {});
      const matIds = Object.keys(doc.materials ?? {});

      if (objIds.length === 0) {
        // Re-seed with an object if all were deleted
        const id = `obj_${nextObjNum++}`;
        doc.objects = {
          ...doc.objects,
          [id]: makeObject(id, { dataId: "msh_0", materialSlots: ["mat_0"] }),
        };
        doc.scenes!.scn_test.objects.push(id);
        continue;
      }

      switch (opChoice) {
        case 0: {
          // 1. Assign material
          const objId = objIds[Math.floor(rng() * objIds.length)];
          if (matIds.length > 0) {
            const matId = matIds[Math.floor(rng() * matIds.length)];
            const obj = doc.objects![objId];
            doc = {
              ...doc,
              objects: {
                ...doc.objects,
                [objId]: {
                  ...obj,
                  materialSlots: [matId],
                  materials: [matId],
                },
              },
            };
          }
          break;
        }

        case 1: {
          // 2. Make single user
          const objId = objIds[Math.floor(rng() * objIds.length)];
          const targetChoice = rng();
          if (targetChoice < 0.6) {
            doc = makeSingleUser(doc, objId, 0);
          } else {
            doc = makeSingleUser(doc, objId, "mesh");
          }
          break;
        }

        case 2: {
          // 3. Delete object (if more than 2 objects exist)
          if (objIds.length > 2) {
            const victimId = objIds[Math.floor(rng() * objIds.length)];
            const nextObjects = { ...doc.objects };
            delete nextObjects[victimId];
            doc = {
              ...doc,
              objects: nextObjects,
              scenes: {
                ...doc.scenes,
                scn_test: {
                  ...doc.scenes!.scn_test,
                  objects: doc.scenes!.scn_test.objects.filter((id) => id !== victimId),
                },
              },
            };
          }
          break;
        }

        case 3: {
          // 4. Duplicate object
          const srcId = objIds[Math.floor(rng() * objIds.length)];
          const srcObj = doc.objects![srcId];
          const newId = `obj_${nextObjNum++}`;
          const dupObj: Object3d = {
            ...structuredClone(srcObj),
            id: newId,
            name: `${srcObj.name}_copy`,
          };
          doc = {
            ...doc,
            objects: {
              ...doc.objects,
              [newId]: dupObj,
            },
            scenes: {
              ...doc.scenes,
              scn_test: {
                ...doc.scenes!.scn_test,
                objects: [...doc.scenes!.scn_test.objects, newId],
              },
            },
          };
          break;
        }

        case 4: {
          // 5. Copy attributes
          if (objIds.length >= 2) {
            const fromId = objIds[Math.floor(rng() * objIds.length)];
            const targets = objIds.filter((id) => id !== fromId && rng() > 0.5);
            if (targets.length > 0) {
              const partChoices: Array<"material" | "modifiers" | "transform" | "visibility"> = [];
              if (rng() > 0.3) partChoices.push("material");
              if (rng() > 0.5) partChoices.push("transform");
              if (rng() > 0.5) partChoices.push("visibility");
              if (partChoices.length === 0) partChoices.push("material");

              doc = copyAttributes(doc, fromId, targets, partChoices);
            }
          }
          break;
        }
      }

      // Check exact match with brute force recount at every 20th step and on final step
      if ((step + 1) % 20 === 0 || step === 199) {
        const counts = userCounts(doc);
        const expected = bruteForceRecount(doc);
        assert.deepStrictEqual(
          counts,
          expected,
          `User counts mismatch at step ${step + 1}`
        );
      }
    }
  });

  it("undo restores sharing and document state through the command bus", () => {
    const unregBlocks = register3dBlocksCommands();
    const unregOutliner = register3dOutlinerCommands();

    try {
      const initialDoc: MotionDocument = {
        ...structuredClone(DEFAULT_DOCUMENT),
        scenes: {
          scn_test: {
            id: "scn_test",
            objects: ["obj_1", "obj_2", "obj_3"],
          },
        },
        materials: {
          mat_gold: { id: "mat_gold", name: "Gold" } as never,
          mat_silver: { id: "mat_silver", name: "Silver" } as never,
        },
        meshes: {
          msh_box: { id: "msh_box", name: "BoxMesh" },
        },
        objects: {
          obj_1: makeObject("obj_1", {
            dataId: "msh_box",
            materialSlots: ["mat_gold"],
          }),
          obj_2: makeObject("obj_2", {
            dataId: "msh_box",
            materialSlots: ["mat_gold"],
          }),
          obj_3: makeObject("obj_3", {
            dataId: "msh_box",
            materialSlots: ["mat_silver"],
          }),
        },
      };

      setDocument(initialDoc);
      useHistoryStore.getState().clearHistory();

      // Initial sharing: mat_gold has 2 users (obj_1, obj_2)
      assert.strictEqual(userCounts(getDocument()).materials.mat_gold, 2);

      // 1. Run 3d.blocks.make_single_user on obj_2
      const res1 = tryRunCommand("3d.blocks.make_single_user", {
        objectId: "obj_2",
        target: "material",
        slot: 0,
      });
      assert.strictEqual(res1.ok, true);

      // Document changed: mat_gold now has 1 user, obj_2 has a new single-user material
      const docAfterSplit = getDocument();
      assert.strictEqual(userCounts(docAfterSplit).materials.mat_gold, 1);
      const newMatId = docAfterSplit.objects!.obj_2.materialSlots![0];
      assert.notStrictEqual(newMatId, "mat_gold");
      assert.strictEqual(userCounts(docAfterSplit).materials[newMatId], 1);

      // 2. Undo restores sharing
      const undone1 = historyCommands.undo();
      assert.strictEqual(undone1, true);

      const docAfterUndo1 = getDocument();
      assert.strictEqual(userCounts(docAfterUndo1).materials.mat_gold, 2);
      assert.deepStrictEqual(docAfterUndo1.objects!.obj_2.materialSlots, ["mat_gold"]);
      assert.strictEqual(docAfterUndo1.materials?.[newMatId], undefined);

      // 3. Test copy_attributes and undo
      // Copy material from obj_1 (mat_gold) to obj_3 (which has mat_silver)
      const res2 = tryRunCommand("3d.blocks.copy_attributes", {
        fromObjectId: "obj_1",
        toObjectIds: ["obj_3"],
        parts: ["material"],
      });
      assert.strictEqual(res2.ok, true);

      // Now obj_1, obj_2, obj_3 all share mat_gold (user count = 3)
      assert.strictEqual(userCounts(getDocument()).materials.mat_gold, 3);
      assert.strictEqual(userCounts(getDocument()).materials.mat_silver, 0);

      // Undo restores obj_3's original material
      const undone2 = historyCommands.undo();
      assert.strictEqual(undone2, true);

      const docAfterUndo2 = getDocument();
      assert.strictEqual(userCounts(docAfterUndo2).materials.mat_gold, 2);
      assert.strictEqual(userCounts(docAfterUndo2).materials.mat_silver, 1);
      assert.deepStrictEqual(docAfterUndo2.objects!.obj_3.materialSlots, ["mat_silver"]);

      // 4. Test outliner reparent and undo
      const res3 = tryRunCommand("3d.outliner.reparent", {
        objectId: "obj_2",
        newParentId: "obj_1",
      });
      assert.strictEqual(res3.ok, true);
      assert.strictEqual(getDocument().objects!.obj_2.parentId, "obj_1");

      const undone3 = historyCommands.undo();
      assert.strictEqual(undone3, true);
      assert.strictEqual(getDocument().objects!.obj_2.parentId, null);

      // 5. Test outliner set_flag and undo
      const res4 = tryRunCommand("3d.outliner.set_flag", {
        id: "obj_1",
        flag: "visible",
        value: false,
      });
      assert.strictEqual(res4.ok, true);
      assert.strictEqual(getDocument().objects!.obj_1.visible, false);

      const undone4 = historyCommands.undo();
      assert.strictEqual(undone4, true);
      assert.strictEqual(getDocument().objects!.obj_1.visible, true);
    } finally {
      unregBlocks();
      unregOutliner();
    }
  });
});
