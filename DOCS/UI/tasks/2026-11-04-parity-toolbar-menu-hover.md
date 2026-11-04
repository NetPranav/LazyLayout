# Task: canvas toolbar size and menu hover highlight (`parity-toolbar-menu-hover`)

- **Given by:** Claude (build session), 2026-11-04, after the user pointed out two differences from `DOCS/UI/design/editor-design-mode-blocks-dark.html`.
- **Files you may touch:** `src/editor/shell/canvas-chrome/{Toolbar,CanvasChrome}.tsx`, `src/editor/components/{Menu,TopBar,IconButton}.tsx` (for this task `Menu.tsx` is **not** read-only; keep every export name and prop), `src/editor/styles/{tokens,tailwind,animations}.css` (only to add or fix tokens and motion classes this task needs), `src/editor/design-system/**` for the matching demos.

## Part 1: toolbar size (measured, not guessed)

Measured in headless Chromium at 1440x900:

| | Prototype `#tools` | App `[role=toolbar]` |
|---|---|---|
| Bar | 443 x 50, `padding: 4px`, `gap: 2px`, radius `--r-lg` (8px), `bottom: 16px`, centred | 311 x 38 |
| Buttons | **40 x 40**, icon **20 x 20**, radius 4px | **28 x 28**, icon 20 |

Make the app's toolbar match: 40 x 40 buttons (use an IconButton size that resolves to a token of 40px, add `--ll-size-tool-btn` or similar if none exists, never a px literal), same padding, gap, group separators (`.gsep`) and bottom offset. Do the same check for the **second bar on the right** (undo, redo, zoom, columns toggle) and for the zoom bar's height. Then compare every other part of the chrome the same way with a measured table (the AI box, the Insert box, the artboard title row, the ruler thickness, the avatar chips top right) and fix what differs. In Motion mode the prototype shows an alternative tool group (`.mtools`: select, hand, add keyframe, play): check how the prototype switches and match it.

## Part 2: menu hover highlight

Reproduce: open the logo menu, hover "Window", then move onto "Right panel" in the submenu.

- **Prototype:** the "Window" row keeps its highlight and the hovered submenu row ("Right panel") is highlighted. Screenshot: `DOCS/UI/handoffs/screenshots/parity-final/menu-hover-proto.png`.
- **App (bug):** the highlight sticks on the wrong row ("File", with a narrower box) while neither "Window" nor "Right panel" is highlighted. Screenshot: `DOCS/UI/handoffs/screenshots/parity-final/menu-hover-app.png`.

Read the prototype's menu code (`rndr`, `placeSub`, `.ll-hl` or `.hl` sliding highlight, `swapSub`) and fix the highlight tracking in `Menu.tsx`: one sliding highlight per surface, parent keeps its row highlighted while its submenu is open, the submenu has its own highlight following the pointer and arrow keys, no highlight left behind on a previous row. Check with real pointer moves across: top-level rows, into a submenu, back out, between submenus (File, Edit, View, Window, Theme, Help), the Select dropdown, the context menu and the layer menu. Also check keyboard (ArrowDown/Up, ArrowRight into the submenu, ArrowLeft back, Escape).

Also compare icons row by row with the prototype's menus (for example the "Right panel", "Left panel", "Layouts", "Theme" icons) and fix the mismatches in `TopBar.tsx`.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals (tokens or one named constants file); React never owns classes or styles motion code writes (use data attributes); no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent (`/NN`) surfaces; respect `prefers-reduced-motion`; every focusable control has a visible focus ring; use `Button`, `IconButton`, `Menu` etc. from `src/editor/components`. Colors only from `DOCS/UI/PALETTE.md` through semantic tokens. `src/editor/motion/*` stays read-only.

## Parallel batch rules

- Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`. Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright`, `pathToFileURL` for the prototype, viewport 1440x900, editor at `/editor`.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`.
- `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only.

## Done

`npx tsc --noEmit` clean (real output in the handoff), a **measured before and after table** for the toolbar (prototype vs app, in numbers), before and after screenshots of the toolbar and of the menu hover states listed above (prototype next to app), and the handoff `DOCS/UI/handoffs/YYYY-MM-DD-HHMM-parity-toolbar-menu-hover.md` from `TEMPLATE.md`. Say what you did not verify. Do not claim parity you did not measure. Do not commit or push.
