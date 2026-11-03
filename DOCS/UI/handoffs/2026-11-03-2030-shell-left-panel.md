# Handoff: Left Panel Shell Component & Lab Route

- **Date / time:** 2026-11-03 20:30
- **Worker:** Antigravity (UI Rebuild Worker)
- **Branch:** ui/redesign
- **Page / phase:** Shell / Phase 1 (Queue item 2)
- **Task given by:** `DOCS/UI/tasks/2026-11-03-shell-left-panel.md`

## What changed
- `src/editor/shell/left-panel/types.ts`: Interface definitions for `LeftPanelProps`, `LayerItem`, `FileItem`, `TrackItem`, `AssetItem`, and `LeftPanelMode`.
- `src/editor/shell/left-panel/sampleData.ts`: Standard sample data for layers, files, tracks, and assets matching the prototype.
- `src/editor/shell/left-panel/LeftPanelHeader.tsx`: Header component with 44px `.zhead`, `headerStart` slot (for `PageSwitcher` in Design mode), section title ("Layers" or "Files" in Motion/Code mode), search icon button with `aria-pressed`, and collapsible `.lsbox` search input with clear button and match counter.
- `src/editor/shell/left-panel/LayersTree.tsx`: Layers tree with `role="tree"`, expand/collapse chevrons, layer type icons, hide/lock affordances via `TreeRow`, keyboard arrow-key navigation, and search filtering that keeps ancestors of matching nodes.
- `src/editor/shell/left-panel/FilesTree.tsx`: File tree for Code mode with `role="tree"`, folders and files icons, selection, expansion, keyboard navigation, and search filtering.
- `src/editor/shell/left-panel/TracksList.tsx`: Motion mode tracks container with 44px `.zhead`, 32px `.trow` items, and track selection.
- `src/editor/shell/left-panel/AssetsSection.tsx`: Assets drawer in Design mode with collapsible header (36px), tool buttons (`#aup` upload, `#asrch` asset search), asset search input, draggable `#lsplit` separator with pointer capture and keyboard resizing (`ArrowUp`/`ArrowDown`), and 2-column asset preview grid.
- `src/editor/shell/left-panel/LeftPanel.tsx`: Top-level `LeftPanel` component coordinating Design, Motion, and Code modes with both controlled and uncontrolled prop fallbacks.
- `src/editor/shell/left-panel/index.ts`: Barrel export for `LeftPanel` and associated types and sample data.
- `src/editor/shell/left-panel/LeftPanelLab.tsx`: Interactive lab page component hosting a 1440 × 900 frame with mode switcher, search toggles, and mock canvas stage.
- `src/app/design-system/left-panel/page.tsx`: Route entry guarded with `labsEnabled` / `notFound()`.
- `DOCS/UI/handoffs/screenshots/left-panel/*.png`: 1440px Playwright screenshots of all modes, search states, and asset drawer states.

## Decisions made
- Used WAI-ARIA `role="tree"` with `aria-activedescendant` and roving focus keyboard handling (`ArrowDown`, `ArrowUp`, `ArrowRight`, `ArrowLeft`, `Home`, `End`, `Enter`, `Space`) across layers and files trees.
- Kept ancestors of matching nodes visible during search queries as specified in prototype behavior (`lsFilter`).
- Implemented `#lsplit` with `role="separator"`, `aria-orientation="horizontal"`, `tabIndex={0}`, pointer capture on drag, and arrow-key accessibility.
- Supported both controlled and uncontrolled states for selection, expansion, search open/query, and assets height, enabling standalone usage in the lab route and drop-in integration into `EditorShell`.
- Left `headerStart` slot active in Design mode for `PageSwitcher` integration by the top bar session.

## Components from other sites
none

## Legacy behaviour dropped
none

## Tokens / palette touched
Used existing `--ll-*` tokens.
- Token wish: `--ll-size-panel-bottom-motion-h: 260px;` (currently styled with `var(--bh, 260px)` matching prototype grid `--bh`).

## Integration notes added
- Component export: `LeftPanel` from `@/editor/shell/left-panel`.
- Mode switching: accepts `mode: "design" | "motion" | "code"`.
- Page switcher integration: pass `<PageSwitcher />` into `headerStart` prop; `LeftPanel` handles hiding/showing header title and page switcher based on `mode`.
- Data props: supports `layers`, `files`, `tracks`, `assets`, `selectedIds`, `onSelect`, `selectedTrackId`, `onSelectTrack`, `expandedIds`, `onToggleExpand`, `onToggleHidden`, `onToggleLocked`, `onRename`.

## Not done / blocked
none

## Phase checks
- typecheck: passed (`npx tsc --noEmit` exited with code 0)
- lint: not run (phase end)
- build: not run (dev server active on port 3000)
- Playwright: passed (6 screenshots captured headless with Chromium 1248 at 1440px)

## Screenshots
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-mode.png`
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-search-open.png`
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-assets-open.png`
- `DOCS/UI/handoffs/screenshots/left-panel/1440-motion-mode.png`
- `DOCS/UI/handoffs/screenshots/left-panel/1440-code-mode.png`
- `DOCS/UI/handoffs/screenshots/left-panel/1440-code-search-open.png`

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):

## Retry 1 (2026-11-03)

### What changed (fixes for every numbered item)
1. **Lab wrapped in `.editor-root` (`LeftPanelLab.tsx:49, 144`):** Wrapped both the outer lab container and the frame in `.editor-root`. Native button bevels are removed via the global button reset in `globals.css:10-21`. The 12px expand chevrons in `TreeRow` now render as clean chevron glyphs without boxed corner bevels.
2. **Pure filtering & match count derivation (`treeFilter.ts`, `LeftPanel.tsx`, `LayersTree.tsx`, `FilesTree.tsx`):**
   - Removed `onMatchCountChange` and `useEffect` `setState` calls from `LayersTree` and `FilesTree`.
   - Extracted shared pure functions (`flattenLayers`, `flattenFiles`, `filterTreeNodes`) in `src/editor/shell/left-panel/treeFilter.ts`.
   - `LeftPanel` derives `matchCount` and `visibleNodes` during render via `useMemo`. Zero 1-frame lag reading "0 layers".
3. **`aria-activedescendant` removed (`LayersTree.tsx`, `FilesTree.tsx`):** Dropped dead `aria-activedescendant` attributes from `#p-layers` and `#p-files` because `TreeRow.tsx` only renders `data-id` and no DOM `id`.
4. **Tracks listbox & option roles (`TracksList.tsx`):**
   - Changed container to `role="listbox"` with `aria-label="Tracks"`.
   - Changed track rows to `role="option"` with `aria-selected={isSelected}`.
   - Removed `ll:outline-none` so standard visible focus ring is active.
5. **Eliminated literals & isolated constants (`constants.ts`, `AssetsSection.tsx`, `TracksList.tsx`, `LeftPanelLab.tsx`):**
   - Created `src/editor/shell/left-panel/constants.ts` with `LAB_FRAME_HEIGHT = 900`, `ASSETS_MIN_HEIGHT = 80`, `ASSETS_MAX_HEIGHT_MIN_BOUND = 160`, `ASSETS_MAX_HEIGHT_RATIO = 0.6`, `ASSETS_KEYBOARD_STEP = 10`, `ASSETS_DEFAULT_HEIGHT = 200`, `ASSETS_COLLAPSED_HEIGHT_PX = 36`, `ASSETS_FALLBACK_PARENT_HEIGHT = 600`.
   - Dynamically computed `aria-valuemax` on `#lsplit` as `Math.max(ASSETS_MAX_HEIGHT_MIN_BOUND, Math.round(parentHeight * ASSETS_MAX_HEIGHT_RATIO))`.
   - Replaced `"var(--bh, 260px)"` with token `"var(--ll-size-bottom-motion-h)"`.
   - Replaced `"36px"` with `${ASSETS_COLLAPSED_HEIGHT_PX}px` / `ll:h-row-lg`.
   - Replaced `260` and `200` in `LeftPanelLab.tsx` with `"var(--ll-size-bottom-motion-h)"` and `"var(--ll-size-bottom-code-h)"`.
6. **Token durations & reduced motion (`AssetsSection.tsx`):**
   - Replaced invalid `ll:duration-120` with `ll:duration-swap`.
   - Added `ll:motion-reduce:transition-none` to chevron and asset tile hover transitions.
7. **Design system component reuse & isolated exceptions:**
   - Search fields in `LeftPanelHeader.tsx` and `AssetsSection.tsx` now use `TextField`.
   - Empty states in `LayersTree.tsx` and `FilesTree.tsx` now use `EmptyState`.
   - Created `src/editor/shell/left-panel/AssetImage.tsx` setting `alt`, `loading="lazy"`, and `decoding="async"`.
   - Created `src/editor/shell/left-panel/AssetTile.tsx` as a documented local exception.
8. **Declarative pointer drag (`AssetsSection.tsx`):**
   - Refactored `#lsplit` to use React `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel` with `setPointerCapture`.
   - No manual DOM `addEventListener` listeners; zero leak potential on unmount.
9. **Assets header flex row layout (`AssetsSection.tsx`):**
   - Header is now a single flex row (`.arow-container`) with `ll:h-row-lg` (36px).
   - Tool buttons (`.atools`) sit directly inside the flex row, eliminating the `absolute` overlay.
10. **Removed default Tailwind scale values (`LeftPanelLab.tsx`):**
    - Replaced `ll:ml-24` with `ll:gap-16`.
    - Replaced `ll:max-w-2xl` with `ll:max-w-canvas`.
    - Replaced `ll:h-96` with `ll:p-8 ll:justify-between`.
    - Replaced `ll:tracking-wider` with `ll:tracking-normal`.
    - Replaced `ll:w-48` and `ll:w-36` with `ll:w-1/2` and `ll:w-1/3`.
11. **State decoupling & shared tree hook:**
    - Moved hardcoded expanded and selection IDs out of `LeftPanel.tsx` defaults into `sampleData.ts` (`DEFAULT_EXPANDED_IDS`, `DEFAULT_SELECTED_IDS`, `DEFAULT_SELECTED_TRACK_ID`) and passed them from `LeftPanelLab.tsx`.
    - Extracted shared tree keyboard navigation (`ArrowDown`, `ArrowUp`, `ArrowRight`, `ArrowLeft`, `Home`, `End`, `Enter`, `Space`) into `src/editor/shell/left-panel/useTreeKeyboardNav.ts`, used by both `LayersTree` and `FilesTree`.
12. **TypeScript compiler check (`npx tsc --noEmit`):**
    - Left-panel files: 0 errors.
    - External worker error detected during project-wide check:
      ```
      src/editor/shell/canvas-chrome/AiBox.tsx(303,15): error TS2322: Type '"ghost" | "primary"' is not assignable to type 'IconButtonVariant | undefined'.
        Type '"primary"' is not assignable to type 'IconButtonVariant | undefined'.
      ```

### Design decisions made in Retry 1
- **Design mode title fallback:** Kept "Layers" text title fallback in `LeftPanelHeader` when `headerStart` (the `PageSwitcher` slot) is not provided, ensuring clear section labeling in standalone lab mode while cleanly yielding to `PageSwitcher` when supplied.
- **`TreeRow` accessibility fallback:** Dropped `aria-activedescendant` from `#p-layers` and `#p-files` because `TreeRow.tsx` does not accept a DOM `id` or `tabIndex` prop and cannot be edited in this worker batch. Roving keyboard navigation manages logical tree selection directly.
- **`AssetTile` & `AssetImage` exceptions:** Isolated in `src/editor/shell/left-panel/` since the design system does not currently export an asset thumbnail tile component.

### Screenshots (all retaken at 1440px with Chromium 1248)
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-mode.png`: Design mode (Layers tree + collapsed Assets drawer, chevron icons rendered cleanly without bevels).
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-search-open.png`: Design mode with search filter box open using `TextField`.
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-assets-open.png`: Design mode with Assets drawer expanded and resizable separator active.
- `DOCS/UI/handoffs/screenshots/left-panel/1440-motion-mode.png`: Motion mode with Layers tree and bottom Tracks section (`role="listbox"`).
- `DOCS/UI/handoffs/screenshots/left-panel/1440-code-mode.png`: Code mode with Files tree (`role="tree"`).
- `DOCS/UI/handoffs/screenshots/left-panel/1440-code-search-open.png`: Code mode with search filter box open.
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-row-hovered.png`: Row hovered state showing background hover styling.
- `DOCS/UI/handoffs/screenshots/left-panel/1440-design-row-selected-affordances.png`: Selected row ("Hero") hovered showing hide (`Eye`) and lock (`Lock`) affordance buttons.

### Not done / blocked
- **`TreeRow.tsx` is read-only for this worker:**
  - `TreeRow.tsx:132` uses `ll:duration-120` which does not exist in the Tailwind theme (should be `ll:duration-swap` or `ll:duration-fade`, with `ll:motion-reduce:transition-none`). Logged for build session / component owner.
  - `TreeRow.tsx` renders `data-id={id}` but does not set `id={id}` on the DOM element and lacks a `tabIndex` prop. When `TreeRow.tsx` is updated by its owner, DOM `id` and `tabIndex` should be added to enable full `aria-activedescendant` or roving tabindex accessibility.
- **Canvas-chrome worker error:** `src/editor/shell/canvas-chrome/AiBox.tsx(303,15)` has an uncommitted `IconButtonVariant` type mismatch from another concurrent session. Left untouched per parallel batch rules.

---

## Retry 2 (2026-11-03)

### Changes made
1. **Clean production props in `LeftPanel.tsx`:**
   - Removed `SAMPLE_LAYERS`, `SAMPLE_FILES`, `SAMPLE_TRACKS`, `SAMPLE_ASSETS` default props and imports from `LeftPanel.tsx`.
   - Data defaults to stable empty arrays (`EMPTY_LAYERS`, `EMPTY_FILES`, `EMPTY_TRACKS`, `EMPTY_ASSETS`).
   - Only `LeftPanelLab.tsx` imports `sampleData.ts`.
2. **Dynamic container height tracking via `useSyncExternalStore` (`AssetsSection.tsx`):**
   - Implemented `useContainerHeight` hook with `useSyncExternalStore` and `ResizeObserver`.
   - Removed unsafe render-time read of `containerRef.current?.clientHeight`.
   - Computes `computedMaxHeight` accurately without state updates in an effect body.
3. **Removed duplicate constant `ASSETS_COLLAPSED_HEIGHT_PX` (`constants.ts`):**
   - Removed `ASSETS_COLLAPSED_HEIGHT_PX` from `constants.ts`.
   - Replaced with token reference `"var(--ll-size-row-lg-h)"` matching `ll:h-row-lg` in `AssetsSection.tsx`.
4. **Replaced non-theme values with tokens:**
   - `TracksList.tsx:46`: Replaced `ll:h-8` with `ll:h-row`.
   - `LeftPanelLab.tsx:221`: Replaced `ll:gap-16` with `style={{ gap: "var(--ll-spacing-16)" }}`.
   - `LeftPanelLab.tsx:230`: Replaced `ll:p-12` with `style={{ padding: "var(--ll-spacing-12)" }}`.
   - `LeftPanelLab.tsx:270, 273`: Replaced `ll:h-8` with `ll:h-row`.
   - `LeftPanelLab.tsx:274`: Replaced `ll:left-24` with `style={{ left: "var(--ll-spacing-6)" }}`.
5. **Visible focus ring & `IconButton` reuse:**
   - Added `ll:outline-none ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset` to tracks in `TracksList.tsx`.
   - Replaced native search clear `<button>` in `LeftPanelHeader.tsx` with design-system `IconButton`.
6. **Roving tabindex & visible focus on tree rows (`LayersTree.tsx`, `FilesTree.tsx`, `useTreeKeyboardNav.ts`):**
   - Synchronized roving `tabIndex` (`0` on active row, `-1` on other rows and non-empty tree containers) via DOM synchronization on `[role="treeitem"]`.
   - Updated `useTreeKeyboardNav` with `containerRef` to move DOM focus directly to target rows on arrow navigation (`ArrowDown`, `ArrowUp`, `ArrowRight`, `ArrowLeft`, `Home`, `End`).
   - Added `ll:focus-visible:outline-2 ll:focus-visible:outline-primary ll:focus-visible:outline-offset-inset` to `TreeRow` className.
   - Preserved `role="tree"` on container and `role="treeitem"` on rows.
7. **Verified reduced motion on asset hover:**
   - Confirmed `AssetTile.tsx` includes `ll:motion-reduce:transition-none` on thumbnail transitions.
8. **Retook all 8 screenshots at 1440px with Playwright:**
   - Updated all screenshots in `DOCS/UI/handoffs/screenshots/left-panel/`.

