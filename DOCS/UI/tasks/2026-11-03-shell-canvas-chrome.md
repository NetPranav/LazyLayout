# Task: rebuild the canvas chrome (`shell`, Phase 1, queue item 3)

- **Given by:** Claude (build session), 2026-11-03. **Area:** `shell`: canvas chrome.
- **Goal:** a `CanvasChrome` component: everything around the artboard in the prototype's `#center`, and nothing inside the artboard (stage, selection and handles are Phase 2). The build session mounts it into the shell later.

## Read only these

- **Prototype:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`
  - CSS: `/* ===== CANVAS ===== */` (~264-380) incl. the floating toolbar, Insert box (~340), AI prompt box (~343), the trace loader `.aiload` (~374-377), and `/* View popover */` (~431-451). Skip the expanded AI chat (~381-430) and the bottom block (~452-474).
  - Markup: `<main class="center">` (~874-929): `#rt` / `#rl` rulers, `.rc0`, `#tools` toolbar, `#ins` Insert, `#aibox` AI box, zoom control; and `#vpop` View options (~990-).
  - Script: ruler drawing, zoom (`zoomAct`), tool selection, Insert open/close and category list (`insr`, `insl`, `insRender`), `vpAt` and the View options sliders and toggles (including "Dropdown bulge"), AI box submit and loading state.
- **App:** `src/editor/components/{IconButton,Tooltip,Popover,SegmentedControl,Toggle,TextField,Icon,Menu}.tsx` and `src/editor/motion/*` (reuse, read-only; use the surface helpers the way `Popover` does).
- **Legacy reference** (read only, non-visual logic): `src/legacy-editor/shell/CanvasChrome.tsx`.

## Behaviour to port (copy values, do not tune)

1. **Rulers** top and left (`--ll-size-ruler`), tick labels, shown or hidden by a prop, plus the `.rc0` corner.
2. **Bottom floating toolbar** (`#tools`, `role="toolbar"`, 16 px above the column's bottom edge): the tool buttons in the prototype, the zoom control, the Insert and AI buttons. Selected tool state, tooltips, arrow-key navigation.
3. **Insert box** (520 x 400 above the toolbar, 8 px gap, no backdrop): category list, search, cards. It springs open and closed from the Insert button, like the menus.
4. **AI box** (same spot): prompt input, send, and the **trace loader** (`.aiload`, 2.4 s, `ll-tro` / `ll-trf`) while loading. Reduced motion: opacity pulse. The top bar worker adds the `ll-tro` / `ll-trf` keyframes to `animations.css`; do not edit that file. Use them by name in a class, and if they are not there yet when you test, note it in the handoff.
5. **View options popover** (`#vpop`): all its toggles and sliders, opening upward from the toolbar.
6. Everything is controlled by props and callbacks with sample state in the lab route. The center area exposes a `children` slot where the artboard will go.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals; React never owns classes or styles motion code writes (use data attributes); no browser-only reads on first render; no raw `requestAnimationFrame`; no `setState` in effects; `ll-` prefix on globals; `useId()` for ids; every icon via `Icon`; native non-passive wheel listeners; no glass, blur or pills.

## Files you may touch

New files under `src/editor/shell/canvas-chrome/**` (export `CanvasChrome` from `src/editor/shell/canvas-chrome/index.ts`) and `src/app/design-system/canvas-chrome/page.tsx`. Nothing else.

## Done

`npx tsc --noEmit` once, screenshots at 1440 of: default, Insert open, AI box open and loading, View options open, rulers on and off, and the handoff. Do not commit.

## Parallel batch rules (4 workers run at once in the same working tree)

- Other workers are editing other files right now. **Edit only the files listed under "Files you may touch".** Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project, so errors in other workers' files may appear. Fix only errors in your own files and note the rest in the handoff.
- **The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`.** Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright` (the default 1243 is not installed). Use your own screenshot folder.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`. Put decisions, integration notes, component sources and token wishes in your handoff and the build session merges them.
- `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx`, `src/editor/motion/*` are read-only for you (another session has uncommitted work there). Need a change? Put it in the handoff under "Not done / blocked".
- Shared files (`tokens.css`, `tailwind.css`, `animations.css`, `ComponentDemos.tsx`, `DesignSystemPage.tsx`, `EditorShell.tsx`, `components/index.ts`) belong to the **top bar worker** only unless your list says otherwise. Use only existing tokens. If you need a new token, use the closest existing one and list the wish in the handoff.
- Verify your component without the shell: add a lab route `src/app/design-system/<your-area>/page.tsx` (copy the `labsEnabled` / `notFound()` guard from `src/app/design-system/page.tsx`) that renders your component inside a 1440 x 900 frame. Screenshots at 1440 only, in `DOCS/UI/handoffs/screenshots/<your-area>/`.
- Write the handoff as `DOCS/UI/handoffs/2026-11-03-HHMM-<your-area>.md` from `TEMPLATE.md`. **Do not commit.**
