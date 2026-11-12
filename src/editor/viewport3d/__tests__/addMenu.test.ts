import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getCommand, runCommand } from "@/core/commands";
import { setEditingScene3d } from "@/core/commands/contextKeys";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { documentCommands, getDocument } from "@/core/store/useDocumentStore";
import { createId } from "@/core/ids";
import { vec3, quat } from "@/core/3d/math";
import {
  ADD_MENU_ITEMS,
  registerAddMenuCommand,
  useAddMenuStore,
  closeAddMenu,
  executeAddItem,
} from "../AddMenu3d";
import { register3dCommands } from "@/core/3d/commands/register";
import { register3dPrimitiveCommands } from "@/core/3d/primitives/commands";
import { register3dTextCommands } from "@/core/3d/text/commands";
import { installAddAtCursorWrapper } from "../addAtCursor";

function assertClose(a: number, b: number, eps = 1e-4) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} to be close to ${b} (diff ${Math.abs(a - b)} > ${eps})`
  );
}

describe("Phase 3D-025: AddMenu3d", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
    useAddMenuStore.getState().closeMenu();
    documentCommands.mutate("Reset Test Doc", (draft) => {
      draft.scenes = {};
      draft.objects = {};
      draft.meshes = {};
      draft.texts = {};
    });
  });

  it("menu items contain Mesh primitives, Text, Light, Camera, and Empty", () => {
    const ids = ADD_MENU_ITEMS.map((item) => item.id);
    assert.ok(ids.includes("mesh"));
    assert.ok(ids.includes("text"));
    assert.ok(ids.includes("light"));
    assert.ok(ids.includes("camera"));
    assert.ok(ids.includes("empty"));

    const meshItem = ADD_MENU_ITEMS.find((item) => item.id === "mesh");
    assert.ok(meshItem?.children);
    const meshChildrenIds = meshItem.children.map((c) => c.commandId);

    assert.ok(meshChildrenIds.includes("3d.add.cube"));
    assert.ok(meshChildrenIds.includes("3d.add.cylinder"));
    assert.ok(meshChildrenIds.includes("3d.add.cone"));
    assert.ok(meshChildrenIds.includes("3d.add.plane"));
    assert.ok(meshChildrenIds.includes("3d.add.circle"));
    assert.ok(meshChildrenIds.includes("3d.add.sphere"));
    assert.ok(meshChildrenIds.includes("3d.add.icosphere"));
    assert.ok(meshChildrenIds.includes("3d.add.torus"));
    assert.ok(meshChildrenIds.includes("3d.add.capsule"));
    assert.ok(meshChildrenIds.includes("3d.add.rounded_box"));
  });

  it("registerAddMenuCommand registers 3d.menu.add with when editing scene guard", () => {
    const unreg = registerAddMenuCommand();
    const cmd = getCommand("3d.menu.add");
    assert.ok(cmd, "3d.menu.add command should be registered");
    assert.equal(cmd.category, "3D");
    assert.equal(cmd.keybinding, "Shift+a");

    // Guard: only active when editing scene
    assert.equal(cmd.when?.({ editingScene3d: false } as never), false);
    assert.equal(cmd.when?.({ editingScene3d: true } as never), true);

    // Running command opens add menu
    assert.equal(useAddMenuStore.getState().isOpen, false);
    setEditingScene3d(true); // the command only runs while a scene is open for 3D editing
    runCommand("3d.menu.add");
    assert.equal(useAddMenuStore.getState().isOpen, true);
    setEditingScene3d(false);

    closeAddMenu();
    assert.equal(useAddMenuStore.getState().isOpen, false);

    unreg();
  });

  it("executeAddItem runs command placing primitive at 3D cursor", () => {
    const unreg3d = register3dCommands();
    const unregPrimitives = register3dPrimitiveCommands();
    const unregText = register3dTextCommands();
    const unregWrapper = installAddAtCursorWrapper();

    const sceneId = createId("scn");
    documentCommands.mutate("Setup Scene", (draft) => {
      draft.scenes = {
        [sceneId]: {
          id: sceneId,
          name: "Scene",
          objects: [],
        },
      };
    });

    useViewportStore.getState().setEditingSceneId(sceneId);
    useViewportStore.getState().setCursor({
      position: vec3(4, 2, -1),
      rotation: quat(0, 0, 0, 1),
    });

    // Execute add cylinder item
    executeAddItem({
      id: "cyl",
      label: "Cylinder",
      commandId: "3d.add.cylinder",
    });

    const doc = getDocument();
    const cylObj = Object.values(doc.objects ?? {}).find((o) =>
      o.name?.includes("Cylinder")
    );
    assert.ok(cylObj, "Cylinder object created");
    assertClose(cylObj.transform.location[0], 4);
    assertClose(cylObj.transform.location[1], 2);
    assertClose(cylObj.transform.location[2], -1);

    unregWrapper();
    unregText();
    unregPrimitives();
    unreg3d();
  });
});
