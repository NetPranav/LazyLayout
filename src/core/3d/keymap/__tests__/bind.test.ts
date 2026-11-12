import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineCommand, getCommand } from "../../../commands/registry";
import { blenderKeymap } from "../blender";
import { beginnerKeymap } from "../beginner";
import { bindKeymap, formatKeyBindingShortcut, getKeymapById } from "../bind";
import type { ContextKeys } from "../../../commands/types";

describe("Phase 3D-020: bindKeymap registry synchronization", () => {
  it("formats keybinding shortcuts cleanly", () => {
    assert.equal(
      formatKeyBindingShortcut({ command: "3d.transform.translate", key: "g", context: "object" }),
      "G"
    );
    assert.equal(
      formatKeyBindingShortcut({ command: "3d.menu.add", key: "a", shift: true, context: "object" }),
      "Shift+A"
    );
    assert.equal(
      formatKeyBindingShortcut({ command: "3d.view.back", key: "Numpad1", ctrl: true, context: "global" }),
      "Ctrl+Numpad1"
    );
    assert.equal(
      formatKeyBindingShortcut({ command: "3d.cursor.place", key: "mouse2", shift: true, context: "global" }),
      ""
    );
  });

  it("retrieves keymap preset by ID", () => {
    assert.equal(getKeymapById("blender").id, "blender");
    assert.equal(getKeymapById("beginner").id, "beginner");
  });

  it("binds Blender keymap and updates command keybindings", () => {
    // Register commands if not already present
    defineCommand({
      id: "3d.transform.translate",
      title: "Translate",
      run: () => {},
    });
    defineCommand({
      id: "3d.transform.rotate",
      title: "Rotate",
      run: () => {},
    });

    const unbind = bindKeymap(blenderKeymap);

    const translateCmd = getCommand("3d.transform.translate");
    assert.ok(translateCmd);
    assert.equal(translateCmd.keybinding, "G");

    const rotateCmd = getCommand("3d.transform.rotate");
    assert.ok(rotateCmd);
    assert.equal(rotateCmd.keybinding, "R");

    // Check `when` clause
    assert.ok(translateCmd.when);
    const mock3dCtx: ContextKeys = {
      canvasFocus: true,
      timelineFocus: false,
      blueprintFocus: false,
      textEditing: false,
      "selection.count": 1,
      "transport.playing": false,
      editingScene3d: true,
    };
    assert.equal(translateCmd.when(mock3dCtx), true);

    const mockTextCtx: ContextKeys = {
      ...mock3dCtx,
      textEditing: true,
    };
    assert.equal(translateCmd.when(mockTextCtx), false);

    const mockNon3dCtx: ContextKeys = {
      ...mock3dCtx,
      editingScene3d: false,
    };
    assert.equal(translateCmd.when(mockNon3dCtx), false);

    unbind();
  });

  it("switches keymap from Blender to Beginner and changes translate key from G to V", () => {
    defineCommand({
      id: "3d.transform.translate",
      title: "Translate",
      run: () => {},
    });

    // 1. Bind Blender keymap -> G
    bindKeymap(blenderKeymap);
    assert.equal(getCommand("3d.transform.translate")?.keybinding, "G");

    // 2. Bind Beginner keymap -> V
    bindKeymap(beginnerKeymap);
    assert.equal(getCommand("3d.transform.translate")?.keybinding, "V");

    // 3. Command in toolbarOnly has keybinding cleared (e.g. 3d.add.cube)
    defineCommand({
      id: "3d.add.cube",
      title: "Add Cube",
      keybinding: "Shift+A",
      run: () => {},
    });
    bindKeymap(beginnerKeymap);
    assert.equal(getCommand("3d.add.cube")?.keybinding, undefined);
  });
});
