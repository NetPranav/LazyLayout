import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { vec3, quat } from "@/core/3d/math";
import {
  resolveAddArgsWithCursor,
  installAddAtCursorWrapper,
  addPrimitiveAtCursor,
} from "../addAtCursor";
import { register3dCommands } from "@/core/3d/commands/register";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { createId } from "@/core/ids";

function assertClose(a: number, b: number, eps = 1e-4) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} to be close to ${b} (diff ${Math.abs(a - b)} > ${eps})`
  );
}

describe("Phase 3D-017 / 3D-019: addAtCursor", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
    documentCommands.mutate("Reset Document for Test", (draft) => {
      draft.scenes = {};
      draft.objects = {};
      draft.meshes = {};
    });
  });

  it("defaults location to active 3D cursor position when omitted", () => {
    useViewportStore.getState().setCursor({
      position: vec3(3.5, -2.0, 1.25),
      rotation: quat(0, 0, 0, 1),
    });
    useViewportStore.getState().setEditingSceneId("scn_test1");

    const resolved = resolveAddArgsWithCursor();
    assert.ok(resolved.location);
    assertClose(resolved.location[0], 3.5);
    assertClose(resolved.location[1], -2.0);
    assertClose(resolved.location[2], 1.25);
    assert.equal(resolved.sceneId, "scn_test1");
  });

  it("preserves explicit location when passed by caller", () => {
    useViewportStore.getState().setCursor({
      position: vec3(10, 20, 30),
      rotation: quat(0, 0, 0, 1),
    });

    const resolved = resolveAddArgsWithCursor({
      location: [1, 2, 3],
      sceneId: "scn_custom",
    });

    assert.ok(resolved.location);
    assertClose(resolved.location[0], 1);
    assertClose(resolved.location[1], 2);
    assertClose(resolved.location[2], 3);
    assert.equal(resolved.sceneId, "scn_custom");
  });

  it("wrapped add commands create objects at the 3D cursor", () => {
    const unreg3d = register3dCommands();
    const unregWrapper = installAddAtCursorWrapper();

    const sceneId = createId("scn");
    documentCommands.mutate("Setup Test Scene", (draft) => {
      draft.scenes = {
        [sceneId]: {
          id: sceneId,
          name: "Test Scene",
          objects: [],
        },
      };
    });

    useViewportStore.getState().setEditingSceneId(sceneId);
    useViewportStore.getState().setCursor({
      position: vec3(5, -4, 3),
      rotation: quat(0, 0, 0, 1),
    });

    // Add cube without explicit location
    addPrimitiveAtCursor("3d.add.cube", { name: "CursorCube" });

    const doc = getDocument();
    const createdObj = Object.values(doc.objects ?? {}).find(
      (o) => o.name === "CursorCube"
    );

    assert.ok(createdObj, "Cube should be created in the document");
    assertClose(createdObj.transform.location[0], 5);
    assertClose(createdObj.transform.location[1], -4);
    assertClose(createdObj.transform.location[2], 3);

    unregWrapper();
    unreg3d();
  });
});
