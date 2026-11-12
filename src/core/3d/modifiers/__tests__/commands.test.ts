import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT } from "../../../store/documentState";
import { setDocument } from "../../../store/documentState";
import { getDocument } from "../../../store/useDocumentStore";
import { tryRunCommand, getCommand } from "../../../commands/registry";
import type { MotionDocument } from "../../../document/schema";
import { register3dModifierCommands } from "../commands";

function createBaseDocument(): MotionDocument {
  const doc = structuredClone(DEFAULT_DOCUMENT);
  doc.scenes = {
    scn1: {
      id: "scn1",
      name: "Scene",
      objects: ["obj_box"],
    },
  };
  doc.objects = {
    obj_box: {
      id: "obj_box",
      name: "Box",
      type: "mesh",
      dataId: "mesh_box",
      transform: {
        location: [0, 0, 0],
        rotationQuat: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      modifiers: [],
    },
  };
  doc.meshes = {
    mesh_box: {
      id: "mesh_box",
      positions: [-1, -1, 0, 1, -1, 0, 1, 1, 0],
      indices: [0, 1, 2],
    },
  };
  return doc;
}

describe("Phase 3D-030: Modifier Typed Commands", () => {
  beforeEach(() => {
    setDocument(createBaseDocument());
  });

  it("registers all 7 canonical modifier commands under category 3D", () => {
    const unregister = register3dModifierCommands();

    const expectedCommands = [
      "3d.modifier.add",
      "3d.modifier.remove",
      "3d.modifier.reorder",
      "3d.modifier.set_param",
      "3d.modifier.set_visibility",
      "3d.modifier.apply",
      "3d.modifier.apply_all",
    ];

    for (const cmdId of expectedCommands) {
      const cmd = getCommand(cmdId);
      assert.ok(cmd, `Command "${cmdId}" must be registered`);
      assert.equal(cmd.category, "3D");
    }

    unregister();
  });

  it("executes add, set_param, set_visibility, reorder, and remove via tryRunCommand", () => {
    const unregister = register3dModifierCommands();

    // 1. Add modifier
    const resAdd1 = tryRunCommand("3d.modifier.add", {
      objectId: "obj_box",
      type: "mirror",
      id: "mod_mirror_1",
      params: { axis: "x" },
    });
    assert.equal(resAdd1.ok, true);

    const docAfterAdd1 = getDocument();
    assert.equal(docAfterAdd1.objects?.obj_box.modifiers?.length, 1);
    assert.equal(docAfterAdd1.objects?.obj_box.modifiers?.[0].id, "mod_mirror_1");

    // Add second modifier
    const resAdd2 = tryRunCommand("3d.modifier.add", {
      objectId: "obj_box",
      type: "array",
      id: "mod_array_1",
      params: { count: 3 },
    });
    assert.equal(resAdd2.ok, true);
    assert.equal(getDocument().objects?.obj_box.modifiers?.length, 2);

    // 2. Set param
    const resParam = tryRunCommand("3d.modifier.set_param", {
      objectId: "obj_box",
      modifierId: "mod_array_1",
      param: "count",
      value: 5,
    });
    assert.equal(resParam.ok, true);
    assert.equal(getDocument().objects?.obj_box.modifiers?.[1].params?.count, 5);

    // 3. Set visibility
    const resVis = tryRunCommand("3d.modifier.set_visibility", {
      objectId: "obj_box",
      modifierId: "mod_mirror_1",
      enabled: false,
    });
    assert.equal(resVis.ok, true);
    assert.equal(getDocument().objects?.obj_box.modifiers?.[0].enabled, false);

    // 4. Reorder
    const resReorder = tryRunCommand("3d.modifier.reorder", {
      objectId: "obj_box",
      modifierId: "mod_mirror_1",
      newIndex: 1,
    });
    assert.equal(resReorder.ok, true);
    assert.equal(getDocument().objects?.obj_box.modifiers?.[0].id, "mod_array_1");
    assert.equal(getDocument().objects?.obj_box.modifiers?.[1].id, "mod_mirror_1");

    // 5. Remove
    const resRemove = tryRunCommand("3d.modifier.remove", {
      objectId: "obj_box",
      modifierId: "mod_array_1",
    });
    assert.equal(resRemove.ok, true);
    assert.equal(getDocument().objects?.obj_box.modifiers?.length, 1);
    assert.equal(getDocument().objects?.obj_box.modifiers?.[0].id, "mod_mirror_1");

    unregister();
  });

  it("applies modifier and bakes geometry into mesh data block", () => {
    const unregister = register3dModifierCommands();

    // Add transform modifier
    tryRunCommand("3d.modifier.add", {
      objectId: "obj_box",
      type: "transform",
      id: "mod_tx_1",
      params: { translation: [10, 0, 0] },
    });

    const resApply = tryRunCommand("3d.modifier.apply", {
      objectId: "obj_box",
      modifierId: "mod_tx_1",
    });
    assert.equal(resApply.ok, true);

    const docAfterApply = getDocument();
    assert.equal(docAfterApply.objects?.obj_box.modifiers?.length, 0);

    const mesh = docAfterApply.meshes?.mesh_box;
    assert.ok(mesh?.positions);
    // Original x was -1, 1, 1 -> after translation by 10 -> 9, 11, 11
    assert.equal(mesh.positions[0], 9);
    assert.equal(mesh.positions[3], 11);
    assert.equal(mesh.positions[6], 11);

    unregister();
  });
});
