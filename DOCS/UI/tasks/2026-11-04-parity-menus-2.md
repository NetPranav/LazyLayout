# Task: menus and toolbar wiring leftovers (`parity-menus-2`)

- **Given by:** Claude (build session), 2026-11-04. The top bar menus, the canvas toolbar and the view options popover exist, but many items do nothing and some prototype items are missing.
- **Files you may touch:** `src/editor/shell/useEditorActions.ts`, `src/editor/shell/EditorShell.tsx`, `src/editor/components/TopBar.tsx`, `src/editor/shell/canvas-chrome/{CanvasChrome,Toolbar,ViewOptionsPopover}.tsx`. Nobody else edits these now.

## Do

1. Open `DOCS/UI/design/editor-design-mode-blocks-dark.html`, read the `MENUS` data and every menu (logo menu, File, Edit, View, Insert, Arrange, Help, Layouts if present, the project name menu) and list every item and shortcut. Compare with `TopBar.tsx` and `useEditorActions.ts`. Add every missing item, in the prototype's order, with the same label, shortcut and separators.
2. For every menu id, wire a real command (`invokeCommand`, history, selection, viewport, theme, mode stores) where one exists in `src/core/commands` or the legacy editor. For ids with no engine support, show the item disabled with a tooltip reason instead of doing nothing silently, and list them in the handoff.
3. View options: the logo menu View, "View options…" opens the `ViewOptionsPopover` anchored under the top bar. Verify in a screenshot. Each toggle (grid, rulers, snapping, outlines and the others the popover lists) must change the real editor state (rulers visibly appear and disappear, the dot grid toggles).
4. The prototype's Layouts submenu (if the prototype has it) and the "Desktop · 1440" artboard title dropdown: wire the dropdown to switch viewport sizes the legacy editor supports.
5. Keyboard shortcuts: press every shortcut shown in the menus in the real editor (headless) and confirm it does what the label says. Fix the ones that don't.
6. Collaborator avatars (AP, RK, SM, +2) in the prototype top bar and canvas: check how `AvatarStack` is fed in the real editor; if the engine has presence data use it, otherwise leave empty and say so.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals (tokens or one named constants file); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent (`/NN`) surfaces; respect `prefers-reduced-motion`; every focusable control has a visible focus ring; use `Button`, `IconButton`, `Menu`, `Select`, `SegmentedControl` etc. from `src/editor/components`, never raw `<button>` look-alikes. Colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Parallel batch rules

- Edit only the files listed under "Files you may touch". Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project; fix only your own errors.
- The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `pathToFileURL`, viewport 1440x900. The editor is at http://localhost:3000/editor. Use your own screenshot folder under `DOCS/UI/handoffs/screenshots/`.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`; put notes in the handoff.
- `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx` and `src/editor/motion/*` are read-only.
- `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only (import their stores, hooks and commands; never edit).

## Done

`npx tsc --noEmit` once at the end (real output in the handoff), before and after screenshots at 1440, and the handoff `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-<short-name>.md` from `TEMPLATE.md`: the difference list with fixed / not fixed, what you did not verify. Do not claim parity you did not check in a screenshot against the prototype. Do not commit or push.
