import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getPrimitiveSpec } from "@/core/3d/primitives/specs";
import { register3dCommands } from "@/core/3d/commands/register";
import { register3dPrimitiveCommands } from "@/core/3d/primitives/commands";
import { runCommand } from "@/core/commands";
import { documentCommands, getDocument, historyCommands } from "@/core/store/useDocumentStore";
import { useViewportStore } from "@/core/render/scene3d/viewportStore";
import { createId } from "@/core/ids";

function assertClose(a: number, b: number, eps = 1e-4) {
  assert.ok(
    Math.abs(a - b) <= eps,
    `expected ${a} to be close to ${b} (diff ${Math.abs(a - b)} > ${eps})`
  );
}

describe("Phase 3D-025: PrimitiveHandles", () => {
  beforeEach(() => {
    useViewportStore.getState().reset();
    documentCommands.mutate("Reset Test Doc", (draft) => {
      draft.scenes = {};
      draft.objects = {};
      draft.meshes = {};
    });
  });

  it("cylinderSpec defines depth handle along Y axis", () => {
    const spec = getPrimitiveSpec("cylinder");
    assert.ok(spec);
    const handles = spec.handles({ radius: 1, depth: 2, vertices: 32 });
    assert.equal(handles.length, 2, "a depth handle and a radius handle");
    assert.deepEqual(handles.map((h) => h.param).sort(), ["depth", "radius"]);
    const depthHandle = handles.find((h) => h.param === "depth")!;
    assertClose(depthHandle.position[1], 1.0); // depth * 0.5
    assertClose(depthHandle.axis[1], 1.0); // Y axis

    // Applying delta
    const updated = depthHandle.apply({ radius: 1, depth: 2, vertices: 32 }, 0.5);
    assertClose((updated as { depth: number }).depth, 2.5);
  });

  it("handle drag updates param live and single transaction undo restores it", () => {
    const unreg3d = register3dCommands();
    const unregPrimitives = register3dPrimitiveCommands();

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

    // 1. Add cylinder
    runCommand("3d.add.cylinder", {
      radius: 1,
      depth: 2,
      vertices: 16,
      name: "TestCyl",
    });

    const doc = getDocument();
    const cylObj = Object.values(doc.objects ?? {}).find((o) => o.name === "TestCyl");
    assert.ok(cylObj, "Cylinder object created");
    const meshBefore = doc.meshes?.[cylObj.dataId!];
    assert.ok(meshBefore?.source);
    assertClose((meshBefore.source.params as { depth: number }).depth, 2.0);

    // 2. Simulate handle drag wrapped in transaction
    const tx = documentCommands.begin("Drag Depth Handle");

    // Interim drag updates (simulating mousemove events)
    runCommand("3d.primitive.set_param", {
      objectId: cylObj.id,
      param: "depth",
      value: 2.4,
    });
    runCommand("3d.primitive.set_param", {
      objectId: cylObj.id,
      param: "depth",
      value: 2.8,
    });
    runCommand("3d.primitive.set_param", {
      objectId: cylObj.id,
      param: "depth",
      value: 3.2,
    });

    // Verify interim update applied
    const docDuring = getDocument();
    const meshDuring = docDuring.meshes?.[cylObj.dataId!];
    assertClose((meshDuring?.source?.params as { depth: number }).depth, 3.2);

    // Commit transaction (pointer up)
    tx.commit();

    // Verify committed state
    const docCommitted = getDocument();
    const meshCommitted = docCommitted.meshes?.[cylObj.dataId!];
    assertClose((meshCommitted?.source?.params as { depth: number }).depth, 3.2);

    // 3. Exactly ONE undo step restores original depth of 2.0
    const undoRes = historyCommands.undo();
    assert.ok(undoRes, "Undo succeeded");

    const docAfterUndo = getDocument();
    const meshAfterUndo = docAfterUndo.meshes?.[cylObj.dataId!];
    assertClose((meshAfterUndo?.source?.params as { depth: number }).depth, 2.0);

    unregPrimitives();
    unreg3d();
  });
});
