# Task: Menu and shell wiring (`shell`, `menus`)

- **Given by:** Claude (build session), 2026-11-03. **Phase:** 2/3, in the Phase 2 parallel batch.

- **Goal:** wire the shell to the engine. You own `src/editor/shell/EditorShell.tsx`, `src/editor/components/{TopBar,ShipPopover,PageSwitcher}.tsx` and `src/editor/shell/canvas-chrome/{CanvasChrome,Toolbar}.tsx` for this task (nobody else edits them). `TopBar` has `onMenuAction(id)` (ids like `file.new`, `edit.copy`, `view.zoomIn`); many canvas chrome callbacks (tool select, zoom, rulers, view options, AI) are unwired.
- **Do:** a hook `src/editor/shell/useEditorActions.ts` mapping every menu id to a real command (`invokeCommand`, history, selection and viewport stores, theme store, mode Design/Motion/Code, panel collapse) or a documented no-op; a keyboard layer for the prototype's shortcuts (V, H, F, R, O, L, T, I, `/`, Ctrl+Z and the others in the menus), ignored while typing in inputs; give View options a trigger (logo menu, View, "View options…") that opens the popover anchored under the top bar.
- **Read:** `src/core/commands` (what exists), the prototype `MENUS` and shortcut JS, legacy `src/legacy-editor/menus/**`.
- **Files you may touch:** the ones named above plus `src/editor/shell/useEditorActions.ts`. Do not mount other workers' components.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals (tokens or one named constants file); React never owns classes or styles motion code writes (use data attributes); no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent (`/NN`) surfaces; respect `prefers-reduced-motion`; every focusable control has a visible focus ring; use `Button`, `IconButton`, `Menu`, `Select`, `SegmentedControl` etc. from `src/editor/components`, never raw `<button>` look-alikes. Colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Parity with the prototype (this time it is checked line by line)

The reviewer diffs your result against `DOCS/UI/design/editor-design-mode-blocks-dark.html`: every control, label, order, icon, menu item and keyboard shortcut. Where the prototype is silent, follow `src/legacy-editor` behaviour restyled to our rules and log it in the handoff.

## Parallel batch rules (6 workers run at once in the same working tree)

- Edit only the files listed under "Files you may touch". Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project, so errors in other workers' files may appear. Fix only your own and note the rest in the handoff.
- The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`. Use your own screenshot folder.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`; put decisions, integration notes, component sources and token wishes in your handoff.
- `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx` and `src/editor/motion/*` are read-only. Need a change? Put it under "Not done / blocked" in the handoff.
- Do not mount your component in `EditorShell.tsx`: the build session does that. Show it in your lab route.
- `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only (import their stores, hooks and logic; never edit).

## Done

`npx tsc --noEmit` once at the end (real output in the handoff), screenshots at 1440 of the lab route in `DOCS/UI/handoffs/screenshots/<short-name>/`, and the handoff `DOCS/UI/handoffs/2026-11-03-<time>-<short-name>.md` from `TEMPLATE.md` with: what is built, props contract, what is wired and what is not, "Not done / blocked", token wishes. Be honest in the handoff: say what you did not verify. Do not commit or push.
