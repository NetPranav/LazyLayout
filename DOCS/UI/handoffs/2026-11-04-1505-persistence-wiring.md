# Handoff: persistence-wiring

- **Date / time:** 2026-11-04 15:05
- **Worker:** Antigravity (worker)
- **Branch:** ui/redesign
- **Page / phase:** Editor Shell / Persistence & Project Lock
- **Task given by:** `DOCS/UI/tasks/2026-11-04-persistence-wiring.md`

## What changed
- `src/editor/shell/EditorShell.tsx`: Wired `useProjectFiles()`, `useProjectLock()`, and `useShellCommands({...})` passing actions from `useEditorActions`. Mounted `RecoveryPrompt`, `SaveErrorBanner`, `FileDropOverlay`, and `ReadOnlyBanner`. Updated `topHeight` to `"auto"` so `ReadOnlyBanner` stacks cleanly below `TopBar`.
- `src/editor/shell/useEditorActions.ts`: Removed duplicate registrations of `installGlobalCommands`, `registerEditingCommands`, `registerSelectionCommands`, `registerFrameCommands`, and `registerTimelineCommands` (which are now managed cleanly by `useShellCommands`).
- `src/editor/shell/persistence/RecoveryPrompt.tsx`: Restyled popover-style crash recovery dialog with Restore/Discard buttons, token colors, modest radius, and accessible alertdialog semantics.
- `src/editor/shell/persistence/SaveErrorBanner.tsx`: Restyled dismissible save error banner reacting to `useSaveStatus` errors and quota limits.
- `src/editor/shell/persistence/ReadOnlyBanner.tsx`: Restyled multi-tab concurrency read-only banner with "Edit here instead" takeover button.
- `src/editor/shell/persistence/FileDropOverlay.tsx`: Restyled dashed-border drop overlay for `.lazy.json` project imports without glass or blur.
- `src/editor/shell/persistence/index.ts`: Export barrel for the persistence components.
- `src/editor/components/TopBar.tsx`: Added quiet project save status indicator (`data-testid="save-status"`, `data-state="saved" | "dirty" | "saving" | "error"`) inside the project name area with tooltip and accessible sr-only label.
- `src/editor/design-system/demos/ShellDemos.tsx`: Added `PersistenceBannersDemo` showcasing all four persistence components in interactive states.
- `src/editor/design-system/demos/ComponentDemos.tsx`: Added interactive state buttons and a 4-state visual showcase for the `save-status` indicator in `TopBarDemo`.
- `src/editor/design-system/DesignSystemPage.tsx`: Registered `PersistenceBannersDemo` in shell navigation and demo rendering.

## Decisions made
- Kept the prototype top bar clean: no extraneous buttons or ID chips were added. The save indicator lives inside `.ll-pinfo` next to the project title as a quiet 6px modest dot (`data-testid="save-status"`).
- `ReadOnlyBanner` renders below `TopBar` in the `"top"` grid area with grid row set to `"auto"` (52px default, expands to 89px when banner is active), pushing down the canvas seamlessly without covering tools or stage controls.
- `useEditorActions` dropped duplicate `installGlobalCommands` and core registration calls to prevent double-firing shortcuts and multiple window dispatchers, as `useShellCommands` already handles them.

## Components from other sites
- none

## Legacy behaviour dropped
- none (Full parity with legacy `EditorShell` project lifecycle, project lock takeover, autosave flush, export/import, and crash recovery).

## Tokens / palette touched
- none (Used existing semantic tokens: `--ll-surface-raised`, `--ll-surface-panel`, `--ll-surface-bar`, `--ll-border-color`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`, `--ll-shadow-soft`).

## Integration notes added
- Wired `useProjectFiles`, `useProjectLock`, and `useShellCommands` from `@/legacy-editor/shell/hooks/*` into `src/editor/shell/EditorShell.tsx`.
- Integrated `useSaveStatus` from `@/core/storage/ProjectSession` and `useProjectLockStore` from `@/core/store/useProjectLockStore`.

## Not done / blocked
- none

## Phase checks
- typecheck: passed (`tsc --noEmit` exited 0 with no errors)
- lint: passed (`eslint src/editor` exited 0 with no errors or warnings)
- build: not run (phase end check)
- Playwright: passed (full automated verification test verifying URL `?projectId=`, headline edit + dirty state, autosave to saved state, reload project persistence, second tab read-only lock, and takeover swap)

## Screenshots
- `DOCS/UI/handoffs/screenshots/persistence-wiring/01-autosaved.png`
- `DOCS/UI/handoffs/screenshots/persistence-wiring/02-reloaded.png`
- `DOCS/UI/handoffs/screenshots/persistence-wiring/03-readonly-second-tab.png`
- `DOCS/UI/handoffs/screenshots/persistence-wiring/04-takeover-swapped.png`
- `DOCS/UI/handoffs/screenshots/persistence-wiring/05-design-system-persistence.png`

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
