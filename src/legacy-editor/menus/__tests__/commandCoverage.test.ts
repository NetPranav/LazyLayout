import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { MENU_MODEL, menuCommandIds } from "../menuModel";

/**
 * ROADMAP Phase 13 coverage test (Law 20): every File/Edit/View/Help menu item
 * resolves to a command registered on the command bus, and none is a live-looking
 * button that does nothing. The Window menu is panel layout, which Phase 14's
 * workspace model replaces. A source scan can only support this gate; the
 * Playwright spec (`tests/e2e/command-bus.spec.ts`) drives the real menus.
 */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__") sourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const registered = new Set<string>();
for (const file of sourceFiles(join(process.cwd(), "src"))) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:defineCommand|useCommand)\(\s*\{\s*id:\s*"([^"]+)"/g)) registered.add(m[1]);
}

describe("Phase 13: menu → command coverage", () => {
  it("every menu command id is registered on the command bus", () => {
    const missing = menuCommandIds().filter((id) => !registered.has(id));
    assert.deepEqual(missing, [], `menu items name commands that nothing registers: ${missing.join(", ")}`);
  });

  it("every menu item is either a command or explicitly pending on a phase", () => {
    for (const [menu, { entries }] of Object.entries(MENU_MODEL)) {
      for (const e of entries) {
        if (e.kind !== "item") continue;
        assert.ok(e.command || e.pending, `${menu} › ${e.label} has neither a command nor a pending phase`);
        assert.ok(!(e.command && e.pending), `${menu} › ${e.label} is both live and pending`);
        if (e.pending) assert.match(e.pending, /^Phase \d+$/, `${menu} › ${e.label}: pending must name a phase`);
      }
    }
  });

  it("no source file adds a raw window keydown shortcut handler outside the known local-UI ones", () => {
    // Escape-to-close handlers and the Space spring-load (needs keyup) are local UI, not shortcuts.
    const allowed = new Set([
      "core/commands/dispatcher.ts",
      "core/events/useTearOff.ts",
      // the old editor (src/legacy-editor)
      "legacy-editor/shell/StudioHeader.tsx",
      "legacy-editor/shell/EditorShell.tsx", // Escape closes Settings
      "legacy-editor/shell/CanvasChrome.tsx", // Escape closes the World popover
      "legacy-editor/shell/hooks/useAiDock.ts", // Escape cancels the AI dock drag
      "legacy-editor/menus/UnifiedLogoMenu.tsx", // Escape closes the logo menu
      "legacy-editor/panels/launcher/ProjectHub.tsx",
      "legacy-editor/canvas/WhiteboardCanvas.tsx",
      "legacy-editor/canvas/CanvasContextMenu.tsx", // Escape closes the context menu
      "legacy-editor/panels/layers/LayersPanel.tsx", // Escape cancels a layer drag
      "legacy-editor/canvas/tools/useToolKeys.ts", // spring-loaded tools: Space (Hand) and Cmd/Ctrl (deep select) need a key-up
      "app/editor/legacy/LegacyStudioHeader.tsx", // Escape closes a menu
      // the new editor (src/editor): keys inside an open popover, menu, palette or list (Escape, arrows, Enter) are local UI
      "editor/components/CommandPalette.tsx",
      "editor/components/Menu.tsx",
      "editor/components/PageSwitcher.tsx",
      "editor/components/Popover.tsx",
      "editor/components/ShipPopover.tsx",
      "editor/components/Tooltip.tsx",
      "editor/panels/details/controls/RowSettingsPopover.tsx",
      "editor/shell/canvas-chrome/AiBox.tsx",
      "editor/shell/canvas-chrome/InsertBox.tsx",
      "editor/shell/canvas-chrome/ViewOptionsPopover.tsx",
    ]);
    // KNOWN DEBT, not an approval: these files of the new editor handle real global shortcuts (tool keys R L Y K V H F T O, Space,
    // Delete, arrow nudging, zoom, Ctrl+/ ...) with raw window listeners instead of commands with a keybinding (Phase 13, Law 20). So the
    // engine's command keybindings and the shortcuts shown in the new menus can disagree. Moving them onto the command bus removes them
    // from this list; do not add to it.
    const pendingCommandMigration = new Set(["editor/shell/useEditorActions.ts", "editor/stage/useStageTransform.ts", "editor/shell/canvas-chrome/CanvasChrome.tsx"]);
    const offenders: string[] = [];
    const root = join(process.cwd(), "src");
    for (const file of sourceFiles(root)) {
      const rel = file.slice(root.length + 1);
      if (allowed.has(rel) || pendingCommandMigration.has(rel)) continue;
      if (/addEventListener\(\s*["']keydown["']/.test(readFileSync(file, "utf8"))) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], "register a command with a keybinding instead of a raw keydown listener");
  });
});
