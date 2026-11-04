# Task: right panel polish (`parity-right-panel-2`)

- **Given by:** Claude (build session), 2026-11-04. The right panel structure now matches; these details still differ from `DOCS/UI/design/editor-design-mode-blocks-dark.html` (prototype screenshot: `DOCS/UI/handoffs/screenshots/parity-right-panel/proto-right-panel.png`, app: `DOCS/UI/handoffs/screenshots/parity-final/design.png`).
- **Files you may touch:** `src/editor/panels/details/**`, `src/editor/shell/right-panel/**`, `src/editor/components/{NumberField,TextField,SegmentedControl,ColorSwatchField}.tsx` (looks only; keep exports and props).

## Fix, then prove with a screenshot diff

1. Section header "..." buttons sit lower than the title baseline. Align them on the title's centre line, same size and weight as the prototype.
2. Field prefixes: the prototype uses icons for Opacity (droplet), Radius (corner), Line height, Letter spacing, Rotation (circular arrow), and W/H labels with a letter on sizing selects ("W Fixed", "H Fixed"). Match every prefix and suffix in Position, Layout, Appearance, Typography, Fill.
3. Align bar and text-align / sizing segmented rows: the prototype uses distinct icons (left edge, centre, right edge, top, middle, bottom; text align left/centre/right; width/height/fixed arrows). Use the same Lucide icons the prototype's inline SVG paths resemble.
4. Fill row opacity shows "10 %" instead of "100%": the field is too narrow or clips the value. Show "100%" like the prototype.
5. Typography: the prototype's weight select reads "W 600 Semi", size "S 30". Match.
6. Plus buttons for Fill, Stroke, Effects (and the sections after them: scroll the panel and compare Animation, Data, Logic, Accessibility with the prototype where it defines them). Same icon and position as the prototype.
7. Selecting other elements (click a layer in the left panel: Subtitle, Get started, Hero image, a frame such as Hero) must show their own values and the right sections for that type (no Typography for a frame or image). Check each one in the real editor and fix what is wrong.

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
