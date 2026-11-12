import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { runCommand } from "@/core/commands";
import { registerViewport3dCommands } from "../viewCommands";
import { PITCH_LIMIT } from "@/core/3d/camera/viewCamera";
import { documentCommands } from "@/core/store/useDocumentStore";
import { vec3, quat } from "@/core/3d/math";

function assertClose(a: number, b: number, eps = 1e-4) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} to be close to ${b} (diff ${Math.abs(a - b)} > ${eps})`
  );
}

describe("Phase 3D-014 – 3D-017: View Commands", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
    useViewportStore.getState().setEditingSceneId("scn_view_test");
  });

  it("registers canonical view commands and updates camera orientation", () => {
    const unreg = registerViewport3dCommands();

    // 1. Top View
    runCommand("3d.view.top");
    let cam = useViewportStore.getState().camera;
    assertClose(cam.yaw, 0);
    assertClose(cam.pitch, PITCH_LIMIT);

    // 2. Front View
    runCommand("3d.view.front");
    cam = useViewportStore.getState().camera;
    assertClose(cam.yaw, 0);
    assertClose(cam.pitch, 0);

    // 3. Right View
    runCommand("3d.view.right");
    cam = useViewportStore.getState().camera;
    assertClose(cam.yaw, Math.PI / 2);
    assertClose(cam.pitch, 0);

    // 4. Back View
    runCommand("3d.view.back");
    cam = useViewportStore.getState().camera;
    assertClose(cam.yaw, Math.PI);
    assertClose(cam.pitch, 0);

    // 5. Bottom View
    runCommand("3d.view.bottom");
    cam = useViewportStore.getState().camera;
    assertClose(cam.yaw, 0);
    assertClose(cam.pitch, -PITCH_LIMIT);

    // 6. Toggle Ortho
    const orthoBefore = useViewportStore.getState().camera.ortho;
    runCommand("3d.view.toggle_ortho");
    assert.equal(useViewportStore.getState().camera.ortho, !orthoBefore);

    unreg();
  });

  it("handles 3d.select.* commands against active scene objects", () => {
    const unreg = registerViewport3dCommands();

    const sceneId = "scn_view_test";
    documentCommands.mutate("Setup Objects for Selection", (draft) => {
      draft.scenes = {
        [sceneId]: {
          id: sceneId,
          name: "Test Scene",
          objects: ["obj_a", "obj_b", "obj_c"],
        },
      };
      draft.objects = {
        obj_a: { id: "obj_a", name: "A", type: "empty", transform: { location: [0, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] } },
        obj_b: { id: "obj_b", name: "B", type: "empty", transform: { location: [1, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] } },
        obj_c: { id: "obj_c", name: "C", type: "empty", transform: { location: [2, 0, 0], rotationQuat: [0, 0, 0, 1], scale: [1, 1, 1] } },
      };
    });

    // Select All
    runCommand("3d.select.all");
    let sel = useViewportStore.getState().selection;
    assert.equal(sel.selected.length, 3);
    assert.ok(sel.selected.includes("obj_a"));
    assert.ok(sel.selected.includes("obj_b"));
    assert.ok(sel.selected.includes("obj_c"));

    // Select None
    runCommand("3d.select.none");
    sel = useViewportStore.getState().selection;
    assert.equal(sel.selected.length, 0);

    // Select Invert
    useViewportStore.getState().setSelection({ active: "obj_a", selected: ["obj_a"] });
    runCommand("3d.select.invert");
    sel = useViewportStore.getState().selection;
    assert.equal(sel.selected.length, 2);
    assert.ok(sel.selected.includes("obj_b"));
    assert.ok(sel.selected.includes("obj_c"));
    assert.ok(!sel.selected.includes("obj_a"));

    unreg();
  });

  it("resets cursor and toggles snap settings via commands", () => {
    const unreg = registerViewport3dCommands();

    // 1. Cursor Reset
    useViewportStore.getState().setCursor({
      position: vec3(9, 8, 7),
      rotation: quat(0, 0, 0, 1),
    });
    runCommand("3d.cursor.reset");
    const cur = useViewportStore.getState().cursor;
    assertClose(cur.position[0], 0);
    assertClose(cur.position[1], 0);
    assertClose(cur.position[2], 0);

    // 2. Snap Toggle
    const snapBefore = useViewportStore.getState().snap.enabled;
    runCommand("3d.snap.toggle");
    assert.equal(useViewportStore.getState().snap.enabled, !snapBefore);

    unreg();
  });
});
