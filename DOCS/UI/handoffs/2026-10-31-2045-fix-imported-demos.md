# Handoff: Fix Imported Demos

- **Date / time:** 2026-10-31 20:45 IST
- **Worker:** Antigravity
- **Branch:** ui/redesign
- **Page / phase:** Phase 1 (Component Import As-Is / Demos Fix)
- **Task given by:** `DOCS/UI/tasks/2026-10-31-fix-imported-demos.md`

## What changed
- `src/editor/design-system/DesignSystemPage.tsx`:
  - Updated `SelectDemo` to use compound primitives (`ImportedSelect.Root`, `ImportedSelect.Trigger`, `ImportedSelect.Value`, `ImportedSelect.Icon`, `ImportedSelect.Portal`, `ImportedSelect.Positioner`, `ImportedSelect.Popup`, `ImportedSelect.List`, `ImportedSelect.Item`, `ImportedSelect.ItemText`, `ImportedSelect.ItemIndicator`).
  - Updated `MenubarDemo` to use compound primitives (`ImportedMenubar`, `ImportedMenubarMenu.Root`, `ImportedMenubarMenu.Trigger`, `ImportedMenubarMenu.Portal`, `ImportedMenubarMenu.Positioner`, `ImportedMenubarMenu.Popup`, `ImportedMenubarMenu.Item`).
  - Updated `DropdownMenuDemo` to use compound primitives (`ImportedDropdownMenu.Root`, `ImportedDropdownMenu.Trigger`, `ImportedDropdownMenu.Portal`, `ImportedDropdownMenu.Positioner`, `ImportedDropdownMenu.Popup`, `ImportedDropdownMenu.Item`, `ImportedDropdownMenu.Separator`).
  - Updated `ContextMenuDemo` to use compound primitives (`ImportedContextMenu.Root`, `ImportedContextMenu.Trigger`, `ImportedContextMenu.Portal`, `ImportedContextMenu.Positioner`, `ImportedContextMenu.Popup`, `ImportedContextMenu.Item`, `ImportedContextMenu.Separator`).
  - Updated `FILE_TREE_DATA` and `FileTreeDemo` to use `type: "folder" | "file"` and `defaultOpen: true` / `defaultOpenIds` instead of nonexistent `isSelectable`.
  - Applied plain `ll:` classes for demo layout containers only, without styling the imported primitives.
- `DOCS/UI/DECISIONS.md`: Logged adaptation of compound primitive APIs in the design system demos.

## Decisions made
- Adapted imported compound demos (Select, Menubar, DropdownMenu, ContextMenu, FileTree) to compound primitive APIs without restyling primitives (logged in `DOCS/UI/DECISIONS.md`).

## Components from other sites
- none (no new components added; only existing imported demos adapted).

## Legacy behaviour dropped
- none

## Tokens / palette touched
- none

## Integration notes added
- none

## Not done / blocked
- none

## Phase checks
- typecheck: passed (`npx tsc --noEmit -p .` prints 0 errors)
- lint: not run (speed rules: mid-phase, no full checks)
- build: not run (speed rules: mid-phase, no full checks)
- Playwright: passed (verified all 5 demos render and interact cleanly with zero React errors, captured screenshots at 1440px wide using installed Chrome `channel: "chrome"`)

## Screenshots
- `DOCS/UI/handoffs/screenshots/imported-fix/select.png`
- `DOCS/UI/handoffs/screenshots/imported-fix/menubar.png`
- `DOCS/UI/handoffs/screenshots/imported-fix/dropdown-menu.png`
- `DOCS/UI/handoffs/screenshots/imported-fix/context-menu.png`
- `DOCS/UI/handoffs/screenshots/imported-fix/file-tree.png`

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
