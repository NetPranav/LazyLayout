import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DOCUMENT } from "../../../store/documentState";
import { insert3dScene, registerSceneCommands } from "../sceneInsert";
import { documentStore, getDocument, historyCommands } from "../../../store/useDocumentStore";
import { useCanvasViewStore } from "../../../store/useCanvasViewStore";
import { useViewportStore } from "../../../render/scene3d/viewportStore";
import { getContextKeys, useContextKeysStore } from "../../../commands/contextKeys";
import { getCommand, isCommandAvailable, invokeCommand } from "../../../commands/registry";
import type { MotionDocument } from "../../../document/schema";

function resetDocument(): void {
  const blank: MotionDocument = {
    ...DEFAULT_DOCUMENT,
    schemaVersion: 7,
    layers: {
      root_frame: {
        id: "root_frame",
        name: "Main Frame",
        archetype: "container",
        parentId: null,
        children: [],
        properties: {
          positioning: "absolute",
          "frame.width": 1200,
          "frame.height": 800,
        },
      },
    },
    scenes: {},
    objects: {},
    meshes: {},
    materials: {},
    lights: {},
    cameras: {},
    armatures: {},
    actions: {},
    worlds: {},
    images3d: {},
  };
  documentStore.setState({
    document: blank,
  });
  useCanvasViewStore.setState({ activeFrameId: "root_frame" });
  useViewportStore.getState().reset();
}

describe("Phase 3D-012: Scene Insert & Exit Commands", () => {
  beforeEach(() => {
    resetDocument();
  });

  it("insert3dScene creates scene, cube mesh, material, camera, light, and scene3d layer", () => {
    const res = insert3dScene({ width: 500, height: 350 });
    assert.equal(res.ok, true);

    const doc = getDocument();
    assert.ok(doc.scenes?.[res.sceneId]);
    const scn = doc.scenes[res.sceneId];
    assert.equal(scn.objects.length, 3); // cube, camera, light

    // Layer created in active frame
    const layer = doc.layers[res.layerId];
    assert.ok(layer);
    assert.equal(layer.archetype, "scene3d");
    assert.equal(layer.properties.scene, res.sceneId);
    assert.equal(layer.properties["frame.width"], 500);
    assert.equal(layer.properties["frame.height"], 350);
    assert.equal(doc.layers.root_frame.children.includes(res.layerId), true);

    // Objects exist
    const objects = Object.values(doc.objects ?? {});
    const cubeObj = objects.find((o) => o.type === "mesh");
    const camObj = objects.find((o) => o.type === "camera");
    const litObj = objects.find((o) => o.type === "light");

    assert.ok(cubeObj && cubeObj.dataId);
    assert.ok(camObj && camObj.dataId);
    assert.ok(litObj && litObj.dataId);

    assert.ok(doc.meshes?.[cubeObj.dataId]);
    assert.ok(doc.cameras?.[camObj.dataId]);
    assert.ok(doc.lights?.[litObj.dataId]);
  });

  it("3d.scene.insert is atomic and round-trips through undo and redo in one step", () => {
    const res = insert3dScene();
    assert.ok(getDocument().layers[res.layerId]);
    assert.ok(getDocument().scenes?.[res.sceneId]);

    // Undo in 1 step
    const undone = historyCommands.undo();
    assert.equal(undone, true);
    assert.equal(getDocument().layers[res.layerId], undefined);
    assert.equal(getDocument().scenes?.[res.sceneId], undefined);

    // Redo in 1 step
    const redone = historyCommands.redo();
    assert.equal(redone, true);
    assert.ok(getDocument().layers[res.layerId]);
    assert.ok(getDocument().scenes?.[res.sceneId]);
  });

  it("3d.scene.exit command leaves editing mode when editingScene3d context key is active", () => {
    const unregister = registerSceneCommands();

    const insertCmd = getCommand("3d.scene.insert");
    const exitCmd = getCommand("3d.scene.exit");

    assert.ok(insertCmd);
    assert.ok(exitCmd);

    // Not available when not editing
    assert.equal(isCommandAvailable(exitCmd, getContextKeys()), false);

    // Enter editing mode
    useViewportStore.getState().setEditingSceneId("scn_dummy");
    assert.equal(getContextKeys().editingScene3d, true);
    assert.equal(isCommandAvailable(exitCmd, getContextKeys()), true);

    // Run exit command
    invokeCommand("3d.scene.exit");
    assert.equal(useViewportStore.getState().editingSceneId, null);
    assert.equal(getContextKeys().editingScene3d, false);
    assert.equal(isCommandAvailable(exitCmd, getContextKeys()), false);

    unregister();
  });
});
