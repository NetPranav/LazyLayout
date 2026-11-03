# Task: Canvas chrome parity: canvas context menu and collaborator avatars

- **Given by:** Claude (build session), 2026-11-04. **Phase:** parity pass after the user's review: the built UI does not match the prototype.

- **Files you may touch:** `src/editor/shell/canvas-chrome/**`, `src/app/design-system/canvas-chrome/**`.
- **Known differences (verified by the build session):**
  1. **No canvas right-click menu.** The prototype's `MENUS.canvas` opens on right-click of empty canvas (see `proto-contextmenu-canvas.png`): Undo `Ctrl+Z`, Redo `Ctrl+Shift+Z`, Paste here `Ctrl+V` (disabled when the clipboard is empty), a separator, Select all `Ctrl+A`, a separator, Add frame `F`, Add text `T`, Insert…, a separator, Zoom (submenu), View (submenu), a separator, Canvas settings…. Copy items, icons, order, separators and submenu contents exactly from the prototype JS. Use the `ContextMenu`/`Menu` components (read-only) like `LayerContextMenu.tsx`. Wire the actions to real commands (`invokeCommand`, history store, selection, `addFrame`) and to the chrome's own callbacks (zoom, insert); unmapped ones are listed in the handoff. The menu must not open on the toolbar or popovers, and element right-clicks belong to the stage worker, so only handle clicks that did not hit an element (use `event.defaultPrevented` or a data attribute).
  2. **No collaborator avatars.** The prototype shows a small bar at the top right of the canvas (`AP RK SM +2`, class `.fbar.fpeople`, see `proto-default.png`). Build it from `AvatarStack` (`src/editor/components`, read-only) with the prototype's position and look, shown only when the `users` prop has entries; the lab passes the four sample users. Wire it to the real collaborators source if one exists in `src/core` (else leave the prop and list it).
  3. After you finish, diff the whole chrome (toolbar, zoom bar, rulers, Insert, AI box, View options) against the prototype once more and fix what still differs.

## How to work (parity pass, strict)

This is a **parity pass**: the shipped UI differs from the prototype and the user wants it to look and behave the same. The reviewer diffs your result against the prototype, screenshot against screenshot.

1. **Capture the prototype yourself.** Open `DOCS/UI/design/editor-design-mode-blocks-dark.html` in headless Playwright (`chromium-1248` under `%LOCALAPPDATA%\ms-playwright`, `page.goto(pathToFileURL(...).href)`, viewport 1440x900) and screenshot the states of your area. Reference captures already exist in `DOCS/UI/handoffs/screenshots/parity/` (`proto-default.png`, `proto-motion.png`, `proto-code.png`, `proto-contextmenu-canvas.png`, `proto-contextmenu-layer.png`, `proto-ship.png`). Read them first.
2. **Capture the current app** at http://localhost:3000/editor the same way (the dev server is already running; never start `next dev` or `next build`).
3. **Write the difference list first** (in your handoff): every visible difference in layout, spacing, type, icons, labels, order, states, motion and behaviour. Then fix **every** item. Copy values from the prototype CSS and JS (grep the ids and classes); do not tune.
4. **Re-capture** after the fixes and save before and after images side by side in `DOCS/UI/handoffs/screenshots/<short-name>/`. Do not claim a fix you did not see in a screenshot.
5. Anything you cannot match (a read-only component, a missing engine command) goes under "Not done / blocked" with the reason. Do not hide gaps.

## Rules that matter here

Tailwind `ll:` prefix, variant order `ll:hover:`; tokens only (no arbitrary values, hex, px or ms literals; add `--ll-` tokens when the prototype uses a value that has none); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent surfaces; honour `prefers-reduced-motion`; every focusable control has a visible focus ring; reuse `src/editor/components` (`Button`, `IconButton`, `Menu`, `Select`, `SegmentedControl`); colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Parallel batch rules (5 workers at once in the same working tree)

- Edit only the files under "Files you may touch". Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project; fix only your own errors and note the rest.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md` (put notes in your handoff). `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx`, `src/editor/motion/*` are read-only (need a change: write it under "Not done / blocked"). `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only; import their stores and commands.
- Do not edit `EditorShell.tsx` or `RightPanelConnected.tsx`; the build session mounts things.

## Done

`npx tsc --noEmit` once at the end (real output in the handoff), before/after screenshots, and the handoff `DOCS/UI/handoffs/2026-11-04-<time>-<short-name>.md` from `TEMPLATE.md`: the difference list with fixed / not fixed per item, props contract, what is wired. Be honest about what you did not verify. Do not commit or push.
