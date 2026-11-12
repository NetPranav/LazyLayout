import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  blenderKeymap,
  beginnerKeymap,
  findConflicts,
  resolve,
  CANONICAL_3D_COMMAND_IDS,
  isCanonical3DCommand,
  BEGINNER_TOOLBAR_ONLY,
  type Keymap,
  type KeyEventLike,
  type KeymapContext,
} from "../index";

describe("Phase 3D-020: 3D Viewport Keymaps", () => {
  it("has zero conflicts in blenderKeymap", () => {
    const conflicts = findConflicts(blenderKeymap);
    assert.deepEqual(
      conflicts,
      [],
      `Expected no conflicts in Blender keymap, found: ${JSON.stringify(conflicts)}`
    );
  });

  it("has zero conflicts in beginnerKeymap", () => {
    const conflicts = findConflicts(beginnerKeymap);
    assert.deepEqual(
      conflicts,
      [],
      `Expected no conflicts in Beginner keymap, found: ${JSON.stringify(conflicts)}`
    );
  });

  it("detects deliberate conflicts in overlapping contexts", () => {
    const conflictingKeymap: Keymap = {
      id: "blender",
      bindings: [
        { command: "3d.transform.translate", key: "g", context: "object" },
        { command: "3d.transform.rotate", key: "g", context: "global" }, // global overlaps object!
      ],
    };
    const conflicts = findConflicts(conflictingKeymap);
    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0][0].key, "g");
    assert.equal(conflicts[0][1].key, "g");
  });

  it("does not report conflicts for identical keys in non-overlapping contexts", () => {
    const nonConflictingKeymap: Keymap = {
      id: "blender",
      bindings: [
        { command: "3d.object.hide", key: "h", context: "object" },
        { command: "3d.select.linked", key: "h", context: "edit" }, // object and edit do not overlap
      ],
    };
    const conflicts = findConflicts(nonConflictingKeymap);
    assert.equal(conflicts.length, 0);
  });

  it("every binding in blenderKeymap references a valid canonical command id", () => {
    for (const binding of blenderKeymap.bindings) {
      assert.ok(
        isCanonical3DCommand(binding.command),
        `Binding for key "${binding.key}" has non-canonical command "${binding.command}"`
      );
    }
  });

  it("every binding in beginnerKeymap references a valid canonical command id", () => {
    for (const binding of beginnerKeymap.bindings) {
      assert.ok(
        isCanonical3DCommand(binding.command),
        `Binding for key "${binding.key}" has non-canonical command "${binding.command}"`
      );
    }
  });

  it("every canonical command is reachable in the beginner keymap (key or toolbarOnly)", () => {
    const keyBoundCommands = new Set(beginnerKeymap.bindings.map((b) => b.command));
    const toolbarCommands = new Set(beginnerKeymap.toolbarOnly ?? []);

    for (const canonicalId of CANONICAL_3D_COMMAND_IDS) {
      const isKeyBound = keyBoundCommands.has(canonicalId);
      const isToolbar = toolbarCommands.has(canonicalId);
      assert.ok(
        isKeyBound || isToolbar,
        `Canonical command "${canonicalId}" is unreachable in beginner keymap (neither bound to key nor in toolbarOnly)`
      );
    }

    // Verify union matches canonical count
    const totalCovered = new Set([...keyBoundCommands, ...toolbarCommands]);
    assert.equal(totalCovered.size, CANONICAL_3D_COMMAND_IDS.length);
    assert.equal(BEGINNER_TOOLBAR_ONLY.length, toolbarCommands.size);
  });

  it("runs Blender scripted journey through key sequence", () => {
    const sequence: Array<{ event: KeyEventLike; context: KeymapContext; expectedCommand: string }> = [
      // 1. Add menu (Shift+A) in object context
      { event: { key: "a", shift: true }, context: "object", expectedCommand: "3d.menu.add" },
      // 2. Translate (G)
      { event: { key: "g" }, context: "object", expectedCommand: "3d.transform.translate" },
      // 3. Rotate (R)
      { event: { key: "r" }, context: "object", expectedCommand: "3d.transform.rotate" },
      // 4. Scale (S)
      { event: { key: "s" }, context: "object", expectedCommand: "3d.transform.scale" },
      // 5. Toggle edit mode (Tab)
      { event: { key: "Tab" }, context: "global", expectedCommand: "3d.mode.toggle_edit" },
      // 6. Select linked in edit mode (L)
      { event: { key: "l" }, context: "edit", expectedCommand: "3d.select.linked" },
      // 7. Frame selected (Numpad .)
      { event: { key: "Numpad." }, context: "global", expectedCommand: "3d.view.frame_selected" },
      // 8. Front view (Numpad 1)
      { event: { key: "Numpad1" }, context: "global", expectedCommand: "3d.view.front" },
      // 9. Back view (Ctrl + Numpad 1)
      { event: { key: "Numpad1", ctrl: true }, context: "global", expectedCommand: "3d.view.back" },
      // 10. Right view (Numpad 3)
      { event: { key: "Numpad3" }, context: "global", expectedCommand: "3d.view.right" },
      // 11. Left view (Ctrl + Numpad 3)
      { event: { key: "Numpad3", ctrl: true }, context: "global", expectedCommand: "3d.view.left" },
      // 12. Top view (Numpad 7)
      { event: { key: "Numpad7" }, context: "global", expectedCommand: "3d.view.top" },
      // 13. Bottom view (Ctrl + Numpad 7)
      { event: { key: "Numpad7", ctrl: true }, context: "global", expectedCommand: "3d.view.bottom" },
      // 14. Toggle ortho (Numpad 5)
      { event: { key: "Numpad5" }, context: "global", expectedCommand: "3d.view.toggle_ortho" },
      // 15. Camera view (Numpad 0)
      { event: { key: "Numpad0" }, context: "global", expectedCommand: "3d.view.camera" },
      // 16. Frame all (Home)
      { event: { key: "Home" }, context: "global", expectedCommand: "3d.view.frame_all" },
      // 17. Toggle wireframe (Shift+Z)
      { event: { key: "z", shift: true }, context: "global", expectedCommand: "3d.shading.wireframe" },
      // 18. Toggle x-ray (Alt+Z)
      { event: { key: "z", alt: true }, context: "global", expectedCommand: "3d.shading.toggle_xray" },
      // 19. Duplicate (Shift+D)
      { event: { key: "d", shift: true }, context: "object", expectedCommand: "3d.object.duplicate" },
      // 20. Parent (Ctrl+P)
      { event: { key: "p", ctrl: true }, context: "object", expectedCommand: "3d.object.parent" },
      // 21. Delete (Delete key and X key)
      { event: { key: "Delete" }, context: "object", expectedCommand: "3d.object.delete" },
      { event: { key: "x" }, context: "object", expectedCommand: "3d.object.delete" },
      // 22. Reset 3D cursor (Shift+C)
      { event: { key: "c", shift: true }, context: "global", expectedCommand: "3d.cursor.reset" },
      // 23. Place 3D cursor (Shift+mouse2)
      { event: { key: "mouse2", shift: true }, context: "global", expectedCommand: "3d.cursor.place" },
    ];

    const executedCommands: string[] = [];
    for (const step of sequence) {
      const cmd = resolve(blenderKeymap, step.event, step.context);
      assert.equal(
        cmd,
        step.expectedCommand,
        `Step failed: expected "${step.expectedCommand}", got "${cmd}" for event ${JSON.stringify(step.event)}`
      );
      if (cmd) executedCommands.push(cmd);
    }

    assert.equal(executedCommands.length, sequence.length);
  });

  it("runs Beginner scripted journey through key sequence", () => {
    const sequence: Array<{ event: KeyEventLike; context: KeymapContext; expectedCommand: string }> = [
      // 1. Move (V)
      { event: { key: "v" }, context: "object", expectedCommand: "3d.transform.translate" },
      // 2. Rotate (R)
      { event: { key: "r" }, context: "object", expectedCommand: "3d.transform.rotate" },
      // 3. Scale (S)
      { event: { key: "s" }, context: "object", expectedCommand: "3d.transform.scale" },
      // 4. Duplicate (Ctrl+D)
      { event: { key: "d", ctrl: true }, context: "object", expectedCommand: "3d.object.duplicate" },
      // 5. Select all (Ctrl+A)
      { event: { key: "a", ctrl: true }, context: "object", expectedCommand: "3d.select.all" },
      // 6. Deselect (Escape)
      { event: { key: "Escape" }, context: "object", expectedCommand: "3d.select.none" },
      // 7. Toggle edit (Tab)
      { event: { key: "Tab" }, context: "object", expectedCommand: "3d.mode.toggle_edit" },
      // 8. Frame selected (F)
      { event: { key: "f" }, context: "object", expectedCommand: "3d.view.frame_selected" },
      // 9. Frame all (Home)
      { event: { key: "Home" }, context: "object", expectedCommand: "3d.view.frame_all" },
      // 10. Wireframe toggle (Z)
      { event: { key: "z" }, context: "object", expectedCommand: "3d.shading.wireframe" },
      // 11. X-Ray toggle (Shift+Z)
      { event: { key: "z", shift: true }, context: "object", expectedCommand: "3d.shading.toggle_xray" },
      // 12. Delete (Delete and Backspace)
      { event: { key: "Delete" }, context: "object", expectedCommand: "3d.object.delete" },
      { event: { key: "Backspace" }, context: "object", expectedCommand: "3d.object.delete" },
    ];

    const executedCommands: string[] = [];
    for (const step of sequence) {
      const cmd = resolve(beginnerKeymap, step.event, step.context);
      assert.equal(
        cmd,
        step.expectedCommand,
        `Beginner step failed: expected "${step.expectedCommand}", got "${cmd}" for event ${JSON.stringify(step.event)}`
      );
      if (cmd) executedCommands.push(cmd);
    }

    assert.equal(executedCommands.length, sequence.length);
  });

  it("returns null when no binding matches", () => {
    const cmd = resolve(blenderKeymap, { key: "NonExistentKey" }, "object");
    assert.equal(cmd, null);
  });
});
