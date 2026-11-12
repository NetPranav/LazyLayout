import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useViewportStore } from "../viewportStore";
import { getContextKeys } from "../../../commands/contextKeys";
import { vec3, quat } from "../../../3d/math";

describe("Phase 3D-012: Viewport Store", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
  });

  it("initializes with Blender default settings and identity camera", () => {
    const state = useViewportStore.getState();
    assert.equal(state.settings.shading, "solid");
    assert.equal(state.settings.xray, false);
    assert.equal(state.keymapId, "blender");
    assert.equal(state.pivot, "median");
    assert.equal(state.orientation, "global");
    assert.equal(state.snap.enabled, false);
    assert.equal(state.snap.target, "grid");
    assert.equal(state.editingSceneId, null);
    assert.equal(getContextKeys().editingScene3d, false);
  });

  it("updates shading settings and persists changes", () => {
    useViewportStore.getState().setSettings((prev) => ({
      ...prev,
      shading: "wireframe",
      xray: true,
    }));

    const state = useViewportStore.getState();
    assert.equal(state.settings.shading, "wireframe");
    assert.equal(state.settings.xray, true);
  });

  it("updates camera, cursor, and snap configurations", () => {
    useViewportStore.getState().setCursor({
      position: vec3(1, 2, 3),
      rotation: quat(0, 0, 0, 1),
    });
    useViewportStore.getState().setSnap({
      enabled: true,
      target: "vertex",
      step: 0.5,
    });
    useViewportStore.getState().setPivot("cursor");
    useViewportStore.getState().setOrientation("local");

    const state = useViewportStore.getState();
    assert.equal(state.cursor.position[0], 1);
    assert.equal(state.cursor.position[1], 2);
    assert.equal(state.cursor.position[2], 3);
    assert.equal(state.snap.enabled, true);
    assert.equal(state.snap.target, "vertex");
    assert.equal(state.snap.step, 0.5);
    assert.equal(state.pivot, "cursor");
    assert.equal(state.orientation, "local");
  });

  it("synchronizes editingSceneId with contextKeys.editingScene3d", () => {
    assert.equal(getContextKeys().editingScene3d, false);

    useViewportStore.getState().setEditingSceneId("scn_test123");
    assert.equal(useViewportStore.getState().editingSceneId, "scn_test123");
    assert.equal(getContextKeys().editingScene3d, true);

    useViewportStore.getState().setEditingSceneId(null);
    assert.equal(useViewportStore.getState().editingSceneId, null);
    assert.equal(getContextKeys().editingScene3d, false);
  });

  it("reset restores all defaults and clears editingSceneId", () => {
    useViewportStore.getState().setEditingSceneId("scn_editing");
    useViewportStore.getState().setKeymapId("beginner");
    useViewportStore.getState().setPivot("individual");

    assert.equal(getContextKeys().editingScene3d, true);

    useViewportStore.getState().reset();

    const state = useViewportStore.getState();
    assert.equal(state.editingSceneId, null);
    assert.equal(state.keymapId, "blender");
    assert.equal(state.pivot, "median");
    assert.equal(getContextKeys().editingScene3d, false);
  });
});
