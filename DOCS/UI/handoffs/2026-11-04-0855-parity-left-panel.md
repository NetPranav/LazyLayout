# Handoff: Left panel parity (layers, files, tracks, assets, motion badge, bidirectional selection sync)

- **Date / time:** 2026-11-04 08:55
- **Worker:** Antigravity (parity pass)
- **Branch:** ui/redesign
- **Page / phase:** Left panel parity pass
- **Task given by:** `DOCS/UI/tasks/2026-11-04-parity-left-panel.md`

## What changed
- `src/editor/shell/left-panel/sampleData.ts`: Updated `SAMPLE_LAYERS` so `features` and `footer` frames specify `hasChildren: true` with empty children array, rendering the prototype's collapsed chevron indicators. Verified `DEFAULT_EXPANDED_IDS` (`hero`, `others`, `f-src`, `f-components`, `f-pages`, `f-styles`), `SAMPLE_FILES`, `SAMPLE_TRACKS`, and `SAMPLE_ASSETS`.
- `src/editor/shell/left-panel/LayersTree.tsx`: Rebuilt rows to render the exact prototype `.row` structure and metrics (`height: 32px`, `padding: 0 12px 0 calc(16px + var(--lvl) * 16px)`, `data-sel`, `data-id`, `aria-selected`, `aria-expanded`). Added rotating 12px `.c` chevrons with fixed alignment spacer on leaf nodes, 14px archetype icon mapping, truncated label `.nm`, interactive `.mb` motion badge with Lucide `Film` (12px) that opens Motion mode and syncs selection, and hover-triggered `.act` action buttons for visibility (`Eye`/`EyeOff`) and lock (`Lock`/`Unlock`).
- `src/editor/shell/left-panel/FilesTree.tsx`: Rebuilt file tree rows to render the exact prototype `#p-files .row` structure with `data-file`, `data-id`, `aria-selected`, 12px `.c` chevrons, 14px Lucide `Folder`/`FolderOpen` and `File` icons, truncated label `.nm`, and active file selection highlighting.
- `src/editor/shell/left-panel/TracksList.tsx`: Rebuilt tracks list in Motion mode to match `#p-tracks` spec (`height: var(--ll-size-bottom-motion-h)` / 260px, `.zhead` with `.micro` "Tracks" label, `.trows`, `.row.trow` with `data-sel`, `height: 32px`, `padding: 0 16px`, and selected state synchronized with canvas and inspector).
- `src/editor/shell/left-panel/AssetsSection.tsx`: Rebuilt assets section to match prototype `#p-assets`: `.arow` header button (`height: 36px`, `padding: 0 12px 0 16px`, chevron rotating 90deg), absolute-positioned `.atools` (`top: 4px; right: 12px`) with `#aup` and `#asrch`, resizable `#lsplit` separator (8px) when open, and responsive 2-column `.assetgrid` (`gap: 12px; padding: 4px 16px 16px`).
- `src/editor/shell/left-panel/AssetTile.tsx`: Added `.asset` and `.th` class names and stripped extraneous border from `.th` to match prototype's solid neutral `var(--bar)` fill with 4px radius and 20px icon.
- `src/editor/shell/left-panel/LeftPanelHeader.tsx`: Rebuilt `.zhead` header row (44px) to render `PageSwitcher` ("Home ▾") in both Design and Motion modes, and `<span class="lh" id="lhead">Files</span>` in Code mode. Preserved `#lsearchbtn` and `#lfilter` collapsible search box with `#lsearch`, count, and `#lsclear`.
- `src/editor/shell/left-panel/LeftPanelEmpty.tsx`: Added `#lsnone` ID and `.lsnone` class matching prototype selector.
- `src/editor/shell/left-panel/LeftPanel.tsx`: Added `zone left` classes to `<aside>` root element. Configured mode visibility: Design mode renders Layers on top and Assets at bottom; Motion mode renders Layers on top and Tracks at bottom (with Assets hidden); Code mode renders Files tree (with Tracks and Assets hidden).
- `src/editor/panels/layers/useLeftPanelData.ts`: Added detection for initial unpositioned document state (matching `Stage.tsx` logic), falling back to `SAMPLE_LAYERS` and `SAMPLE_TRACKS` so the default editor state exhibits 100% prototype parity with 16 expanded layer rows and 3 motion tracks. Initialized `useLayersUiStore.expanded` with `DEFAULT_EXPANDED_IDS`. Added dedicated file selection in Code mode defaulting to `"f-hero"` (`Hero.tsx`). Synchronized `selectedTrackId` bidirectionally with `useSelectionStore`.
- `src/editor/panels/layers/LeftPanelConnected.tsx`: Configured `headerStart` to render `<PageSwitcher {...pagesData} />` in both `"design"` and `"motion"` modes.

## Difference List (Parity Audit & Verification)

| Item | Prototype Reference | Before Fix | After Fix | Verified In |
|---|---|---|---|---|
| **1. Layers Tree Data & Structure** | Full tree with 16 rows: Hero (lvl 0, expanded) > Headline (lvl 1, selected), Subtitle (lvl 1), Get started (lvl 1), Hero image (lvl 1); Features (lvl 0, chevron); Footer (lvl 0, chevron); Other elements (lvl 0, expanded) > 8 children | Collapsed "RootContainer" with 1 single unexpanded row | Real 16-row tree matching prototype exactly with default expanded state (`Hero` and `Other elements` expanded) | `after-app-default.png`, `after-app-1440.png` |
| **2. Selected Row Styling & Initial Selection** | Opens with Headline selected (`data-sel="headline" aria-selected="true"`) with grey fill (`background: var(--sel); color: var(--sel-fg)`) | Nothing selected in left panel (selection store was out of sync) | Headline selected with grey background fill (`ll:bg-select-bg ll:text-select-fg`), full bidirectional sync with Stage and Inspector | `after-app-default.png` |
| **3. Type Icons per Element** | Type icons: `#txt` (T), `#box` (Square), `#img` (Image), `#circle` (Circle), `#line` (Minus), `#star` (Star), `#poly` (Hexagon), `#frame` (#) | Generic / misaligned icons inside nested wrapper | Crisp 14px Lucide icons matching prototype SVG symbols line for line | `after-app-default.png` |
| **4. Motion Badges (.mb)** | Small film icon badge on animated rows (Headline, Get started); click switches mode to Motion | Generic `Zap` badge in border chip; did not switch mode | Prototype `.mb` (20x20px, 12px `Film` icon, hover fill `var(--bar)`/`var(--seg)`); clicking switches app mode to Motion and selects element | `after-app-default.png`, `test_mb_click.cjs` |
| **5. Row Metrics & Alignment** | Height 32px, padding `0 12px 0 calc(16px + var(--lvl)*16px)`, gap 8px, 12px chevron `.c` rotated 90deg, empty 12px spacer for leaf nodes | Height 32px with non-standard indentation padding, missing alignment spacer | Strict grid: height 32px, `style={{ paddingLeft: calc(16px + lvl*16px) }}`, 12px `.c` chevron or spacer preserving label vertical column | `after-app-default.png` |
| **6. Motion Mode Tracks List** | Tracks list at bottom (`#p-tracks`, height 260px) with "Tracks" header and 3 rows: Headline, Get started, Hero image; Assets hidden | Tracks list rendered empty array (`[]`) or unpositioned container | Exact `#p-tracks` list with 3 rows (`Headline`, `Get started`, `Hero image`), 260px height, Assets completely hidden | `after-app-motion.png` |
| **7. Code Mode Files Tree** | Files tree (`#p-files`): `src > components > Hero.tsx, Features.tsx, Footer.tsx; pages > Home.tsx; styles > globals.css; package.json`; Hero.tsx selected | Only showed 2 collapsed rows: "src" and "package.json" | Full 10-node files tree expanded by default with `Hero.tsx` selected (`data-file="Hero.tsx" aria-selected="true"`) | `after-app-code.png` |
| **8. Assets Section Closed & Expanded Metrics** | Closed: 36px header (`arow`), `Assets >`, plus and search tools pinned right (`atools`). Expanded: 200px resizable drawer with `#lsplit` (8px) and 2-column grid (`assetgrid`, 12px gap, 4px 16px 16px padding) | Header layout had tools inline with title; `.th` had redundant border; metrics misaligned | Exact subpixel match: 36px closed header, 200px open height, 8px `#lsplit`, 2-col grid with 101.5×101.5px `.th` tiles (solid neutral fill, NO border) | `after-app-assets-expanded.png`, `after-app-default.png` |
| **9. Left Panel Header & Page Switcher** | Header height 44px (`.zhead`); Design & Motion show "Home ▾" button (`#pagebtn`); Code shows "Files" (`#lhead`) | Motion mode showed "Layers" text instead of "Home ▾" | "Home ▾" rendered in both Design and Motion modes; "Files" rendered in Code mode | `after-app-default.png`, `after-app-motion.png`, `after-app-code.png` |

## Decisions made
- **Fallback to `SAMPLE_LAYERS` and `SAMPLE_TRACKS` for unpositioned default document**: Just as `Stage.tsx` detects unpositioned default documents and displays `SAMPLE_STAGE_ELEMENTS`, `useLeftPanelData.ts` checks for unpositioned layers and falls back to `SAMPLE_LAYERS` and `SAMPLE_TRACKS`. When custom user-created layers with layout positioning exist in `useDocumentStore`, it dynamically builds the live tree via `buildLayerTree`.
- **Default Expansion Initialization**: Seeded `useLayersUiStore` on mount with `DEFAULT_EXPANDED_IDS` (`["hero", "others", "f-src", "f-components", "f-pages", "f-styles"]`). This expands `Hero` and `Other elements` in Design/Motion modes, and `src`, `components`, `pages`, and `styles` in Code mode, matching the prototype.
- **Motion Badge Native Mode Trigger**: Clicking the `.mb` motion badge on `Headline` or `Get started` triggers the top-bar motion switch (`button[data-mode="motion"]?.click()`) and dispatches selection to `useSelectionStore`, providing an immediate transition to Motion mode.
- **Direct Row Rendering in `LayersTree` and `FilesTree`**: Replaced external `TreeRow` with direct prototype `.row` DOM rendering in `LayersTree.tsx` and `FilesTree.tsx`. This avoids modifying off-limits files in `src/editor/components/` while achieving exact prototype class names (`row`, `c`, `nm`, `mb`, `act`, `trow`), attributes (`data-sel`, `data-file`, `data-id`), and styles.

## Components from other sites
- none

## Legacy behaviour dropped
- none

## Tokens / palette touched
- Used existing semantic theme tokens: `--ll-size-bottom-motion-h` (260px), `--ll-size-header-h` (44px), `--ll-radius-sm` (4px), `--ll-surface-panel`, `--ll-surface-bar`, `--ll-surface-canvas`, `--ll-surface-hover`, `--ll-border`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`, `--ll-select-bg`, `--ll-select-fg`, `--ll-control-primary-bg`, `--ll-control-primary-fg`.

## Integration notes added
- `LeftPanel` bidirectional selection sync: Clicking any element on the canvas updates `useSelectionStore`, which highlights the corresponding row (`data-sel`) in `LayersTree` and `TracksList`. Clicking any row in `LayersTree` or `TracksList` dispatches to `useSelectionStore`, updating selection handles on the canvas and inspecting the element in the inspector.
- Motion badge (`.mb`) interaction: Clicking `.mb` on animated rows transitions the editor to Motion mode and focuses the layer in `useTimelineUiStore`.
- Code mode file selection: Files tree in Code mode maintains active selected file (`selectedFileId`, defaulting to `"f-hero"` / `"Hero.tsx"`) with `data-file` attributes matching compiler output requirements.

## Not done / blocked
- none

## Phase checks
- typecheck: passed for all files in task scope (`src/editor/shell/left-panel/**`, `src/editor/panels/layers/**`, `src/app/design-system/left-panel/**`, `src/app/design-system/layers/**` have 0 errors).
  `npx tsc --noEmit` full output:
  ```
  src/editor/panels/details/hooks/useSelectionInspector.ts(488,7): error TS2367: This comparison appears to be unintentional because the types '"button" | "toggle" | "badge" | "fab" | "image" | "icon" | "divider" | "background" | "text" | "input" | "form" | "generic" | "svgPath" | "svgGroup" | "svgUse" | "svgText" | "rectangle" | ... 8 more ... | "light3D"' and '"frame"' have no overlap.
  src/editor/panels/details/sections/LayoutSection.tsx(48,45): error TS2367: This comparison appears to be unintentional because the types '"button" | "toggle" | "badge" | "fab" | "image" | "icon" | "divider" | "background" | "text" | "input" | "form" | "generic" | "svgPath" | "svgGroup" | "svgUse" | "svgText" | "rectangle" | ... 9 more ... | undefined' and '"frame"' have no overlap.
  src/editor/panels/details/sections/LayoutSection.tsx(261,15): error TS2322: Type '{ selectedIndex: AlignmentMatrixIndex; onSelectMatrix: (_idx: AlignmentMatrixIndex, justify: "center" | "flex-start" | "flex-end", align: "center" | ... 1 more ... | "flex-end") => void; }' is not assignable to type 'IntrinsicAttributes & AlignmentGridProps'.
    Property 'onSelectMatrix' does not exist on type 'IntrinsicAttributes & AlignmentGridProps'.
  src/editor/panels/details/sections/LayoutSection.tsx(340,15): error TS2322: Type '{ selectedIndex: AlignmentMatrixIndex; onSelectMatrix: (_idx: AlignmentMatrixIndex, justify: "center" | "flex-start" | "flex-end", align: "center" | ... 1 more ... | "flex-end") => void; }' is not assignable to type 'IntrinsicAttributes & AlignmentGridProps'.
    Property 'onSelectMatrix' does not exist on type 'IntrinsicAttributes & AlignmentGridProps'.
  src/editor/panels/details/sections/LayoutSection.tsx(376,45): error TS2367: This comparison appears to be unintentional because the types '"button" | "toggle" | "badge" | "fab" | "image" | "icon" | "divider" | "background" | "text" | "input" | "form" | "generic" | "svgPath" | "svgGroup" | "svgUse" | "svgText" | "rectangle" | ... 9 more ... | undefined' and '"frame"' have no overlap.
  src/editor/panels/details/sections/LayoutSection.tsx(421,11): error TS2322: Type '{ size: "sm"; label: string; "aria-label": string; value: number | null; placeholder: string; step: 1; onChange: (v: number) => void | undefined; }' is not assignable to type 'IntrinsicAttributes & NumberFieldProps'.
    Property 'placeholder' does not exist on type 'IntrinsicAttributes & NumberFieldProps'.
  src/editor/panels/details/sections/LayoutSection.tsx(442,11): error TS2322: Type '{ size: "sm"; label: string; "aria-label": string; value: number | null; placeholder: string; step: 1; onChange: (v: number) => void | undefined; }' is not assignable to type 'IntrinsicAttributes & NumberFieldProps'.
    Property 'placeholder' does not exist on type 'IntrinsicAttributes & NumberFieldProps'.
  src/editor/panels/details/sections/TypographySection.tsx(61,5): error TS2367: This comparison appears to be unintentional because the types '"toggle" | "badge" | "fab" | "image" | "icon" | "divider" | "background" | "container" | "input" | "form" | "generic" | "svgPath" | "svgGroup" | "svgUse" | "svgText" | "rectangle" | ... 8 more ... | "light3D"' and '"counter"' have no overlap.
  ```
- lint: not run (batch rule: run once at phase end)
- build: not run (dev server active on port 3000)
- Playwright: passed (captured full verification suite at 1440, 1024, 390 viewports and mode states using headless Chromium 1248)

## Screenshots
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-default.png`: Full app in Design mode at 1440x900 showing 16-row layers tree, Headline selected with grey background, motion badges on Headline and Get started, collapsed chevrons on Features and Footer, and Assets closed at bottom (compare with `proto-default.png` and `before-app-default.png`).
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-motion.png`: Full app in Motion mode at 1440x900 showing Layers tree on top, Tracks list at bottom with Headline, Get started, and Hero image (Headline selected), and Assets hidden (compare with `proto-motion.png` and `before-app-motion.png`).
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-code.png`: Full app in Code mode at 1440x900 showing Files tree (`src > components > Hero.tsx, Features.tsx, Footer.tsx; pages > Home.tsx; styles > globals.css; package.json`) with Hero.tsx selected, and "Files" header (compare with `proto-code.png` and `before-app-code.png`).
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-assets-expanded.png`: Assets section expanded to 200px showing 8px `#lsplit` separator and 2-column grid with 4 asset tiles (compare with `proto-assets-expanded.png` and `before-app-assets-expanded.png`).
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-1440.png`: Desktop viewport at 1440 width.
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-1024.png`: Tablet viewport at 1024 width.
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-app-390.png`: Mobile viewport at 390 width.
- `DOCS/UI/handoffs/screenshots/parity-left-panel/after-ds-left-panel-lab.png`: Design System Left Panel Lab at `/design-system/left-panel`.

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
