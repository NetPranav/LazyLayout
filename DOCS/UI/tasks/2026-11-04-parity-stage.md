# Task: Stage parity: artboard, selection and handles

- **Given by:** Claude (build session), 2026-11-04. **Phase:** parity pass after the user's review: the built UI does not match the prototype.

- **Files you may touch:** `src/editor/stage/**`, `src/app/design-system/stage/**`.
- **Known differences (verified by the build session):** in the prototype the artboard sits **centered** in the canvas at **59% zoom** with the title row "Desktop · 1440 v" above it; ours is at 100%, pushed left and cut off, with a crosshair guide line through it. The prototype opens with **Headline selected**: a 1 px selection outline, **8 square resize handles** and a dark **size chip "340 x 82"** under the box; ours shows no selection. Hover outline, click to select, shift-click, drag-move and resize must work like the prototype (copy the prototype's selection JS) and **select through the real selection store** so the layers tree and the inspector follow.
- **Also:** the element right-click must open the same menu as the layer rows (`MENUS.elem` in the prototype; the component is `src/editor/shell/left-panel/LayerContextMenu.tsx`, read-only, import it) and right-click selects the element first. Empty-canvas right-click is the canvas chrome worker's: do not build it.
- **Fit and zoom:** the default zoom and fit-to-screen must center the artboard. Read the viewport state from `src/core/store/useCanvasViewStore` and keep zoom-to-selection and zoom-to-fit working.

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
