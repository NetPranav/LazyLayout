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

## Retry 1: review failed (2026-11-03)

The overlays morph through `surf()` correctly, `useId()` is used for the search and textarea ids, and the listeners are cleaned up. Fix these. Same file list as before. Items 1-14 are required.

1. **Lab inside `.editor-root`** (`CanvasChromeLab.tsx:46-47,146-149`). Wrap it as `src/app/design-system/page.tsx` does, and apply the theme on that wrapper, not on `document.documentElement` (`:27`). Use one 1440 x 900 frame from tokens (`--ll-size-viewport-desktop`), not `ll:w-[1440px]`, `ll:h-[900px]` and an inline style together.
2. **No `setState` in effects** (`CanvasChromeLab.tsx:26-28,31-44`). Read `searchParams` in `page.tsx` and pass the initial values as props to `useState` initialisers.
3. **No translucent backgrounds:** `ll:bg-surface-raised/90` (`CanvasChromeLab.tsx:51`) becomes the solid `ll:bg-surface-raised`. Drop the word "Pill" from the comment at `:48`.
4. **`AiBox.tsx:37-41`** calls `setAiState(initialState)` in an effect. Derive the state from the `aiLoading` prop (controlled) so the loader follows it after mount (`CanvasChrome.tsx:419` currently passes it only as `initialState`).
5. **`AiBox.tsx:164-169`**: remove the fake 1.5 s `setTimeout` to "done". The state comes from props (`idle`, `work`, `done`) with `onStop`, `onUndo` and `onKeep` callbacks. The lab drives it.
6. **No raw `requestAnimationFrame`:** `AiBox.tsx:103,177,186`, `InsertBox.tsx:77`. Use `autoFocus`, a ref callback or the motion helpers. Run `fitTextarea` from `onChange`.
7. **No ms literals:** `240` at `InsertBox.tsx:83`, `AiBox.tsx:110`, `ViewOptionsPopover.tsx:177`, and `1500` at `AiBox.tsx:168`. Use a named constant from `src/editor/motion` (read it, do not edit it) or a `--ll-dur-*` token.
8. **No px literals or arbitrary values:** `InsertBox.tsx:157` (520, 400, 74), `:182` (136), `:298` (`ll:rounded-[2px]`), `:280` (`ll:aspect-[4/3]`); `AiBox.tsx:62` (108), `:207` (480, 74), `:244` (`ll:max-w-[120px]`); `ViewOptionsPopover.tsx:224-226` (280, 74, `calc(100vh - 120px)`); `CanvasChrome.tsx:297,352,353` (24px, 8px, 0.25); the `* 0.5` factor in `Rulers.tsx:26,38`; the lab's `:186-188,207-228`. Use the closest existing token, derive 74 from the toolbar height plus a gap token, and list the new overlay-size tokens you wish for in the handoff.
9. **Prefix globals with `ll-` and use `useId()` or `data-*` hooks** instead of fixed ids. Classes: `center cv stagewrap stage pxgrid fbar ftool fzoom gsep zb mono ins insq insb insl insr insgrid insg insnone card thumb big cname aibox aiload aiwork aitag aisend aisugg aidone aitxt vpop vact rt rl rc0 tro tfl artboard atit noruler`. Ids: `center stage tools plusbtn aibtn viewbtn panelbtn undobtn redobtn zoombtn pct ins insl insr aibox vpop vfocus worldbtn gsize bgsize rt rl artboard`, `lab-*`. Delete the ones not needed.
10. **Trace loader:** use the `ll-tro` and `ll-trf` keyframes **by name** (the top bar worker has added them to `animations.css`; read that file, do not edit it). The classes `tro` and `tfl` are not keyframe names. Add the reduced-motion variant (an opacity pulse, no trace). Confirm in a screenshot that the loader is mid-trace (take two frames 600 ms apart if needed) and say so in the handoff.
11. **ARIA:** the Insert categories (`InsertBox.tsx:193,214`) are mutually exclusive, so use `role="tablist"` and `role="tab"` with `aria-selected`. The Insert, AI and View buttons (`Toolbar.tsx:136-218`) are disclosure buttons: keep `aria-expanded` and drop `pressed`. The panels toggle stays pressed.
12. **Toolbar** (`Toolbar.tsx:89-115,301`): roving `tabindex` (one tab stop for the toolbar, arrows move), covering the zoom control too. The zoom button has `aria-haspopup="menu"` but opens nothing: wire the zoom menu from the prototype's `zoomAct` (Zoom in, Zoom out, Fit, 100%, selection) with the `Menu` component, or remove `aria-haspopup` and log the drop. `handleZoomIn` and `handleZoomOut` must be reachable from the UI. The Shape button needs the shape picker (circle or box) from the prototype, or log the drop under "Legacy behaviour dropped".
13. **Use design-system components, not raw buttons.** `Toolbar.tsx:302` duplicates `IconButton`. The Insert category buttons (`InsertBox.tsx:190-227`), AI buttons (`AiBox.tsx:219-231,289-301,309-316,345-351`), lab buttons (`CanvasChromeLab.tsx:56-142`) and the Dots/Lines `SegmentedControl` render with browser default 3D bevels in `insert-open.png` and `view-options-open.png`. Item 1 fixes the reset. Also reuse `Button` and `IconButton` where they fit. Anything one-off stays in your folder and is listed in the handoff as an exception.
14. **Focus rings:** the Insert categories (`InsertBox.tsx:198,219`), `CardItem` (`:278`, `ll:outline-none` with no replacement), the AI buttons, the `vact` rows (`ViewOptionsPopover.tsx:239,252`) and the range inputs (`:283,395`) need a visible focus ring, the same as `Toolbar.tsx:302`.
15. **Verify these tokens exist** in the `@theme` block of `tailwind.css`, and replace any that do not: `ll:accent-control-primary` (`ViewOptionsPopover.tsx:292,404`), `ll:offset-inset` (`Toolbar.tsx:302`), `ll:text-nano`, `ll:shadow-soft`, `ll:left-ruler`, `ll:w-ruler`. Check `ll:group-hover:` and `ll:placeholder:` against the variant order rule (`ll:` then the variant). A class that does not resolve silently does nothing.
16. Native range inputs (`ViewOptionsPopover.tsx:283,395`): use the Classic slider style from the design system if a slider component exists. If none, keep the native input, style it with tokens, and list "Slider component" as a wish. The popover scrolls, so show a scroll affordance or size it so nothing is cut off.
17. **Themes** (`ViewOptionsPopover.tsx:350-368`): check against `DOCS/UI/PALETTE.md` and the five themes. The option list and the guard arrays must match (`darkroom` and `plum` appear in the guards but not in the options). Do not invent themes.
18. `CanvasChrome.tsx:92-152`: about 30 pairs of `controlledX ?? localX`. Replace them with one small `useControllable` helper.
19. Handoff "Retry 1" section: the real `npx tsc --noEmit` output after the fixes; correct the claims about the zoom menu and shape picker under "Legacy behaviour dropped" if either stays out; the token wishes.
