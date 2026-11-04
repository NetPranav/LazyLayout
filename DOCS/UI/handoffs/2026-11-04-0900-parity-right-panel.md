# Handoff: Right panel parity (Design inspector, header, section headers, fields, and real selection data)

- **Date / time:** 2026-11-04 09:00
- **Worker:** Antigravity (parity pass)
- **Branch:** ui/redesign
- **Page / phase:** Right panel parity pass
- **Task given by:** `DOCS/UI/tasks/2026-11-04-parity-right-panel.md`

## What changed
- `src/editor/panels/details/hooks/useSelectionInspector.ts`: Added `PROTOTYPE_ELEMENTS` map with coordinates, dimensions, typography, and fills matching prototype `DATA`/`TYPE`/`TXT`/`KIND`. Fixed root cause of "Mixed" values on default load when initial stage elements are not yet registered in `useDocumentStore.document.layers`. Dynamically resolves `selectionName`, `selectionIcon` (e.g. `Type` icon for text layers, `Frame` for containers, `Square` for buttons), `isFrame`, and tracks local property mutations.
- `src/editor/shell/right-panel/RightPanelSection.tsx`: Rebuilt section header to match prototype `.dtitle` structure. Removed chevrons; made titles plain `<h3>` with font-size 13px, font-weight 500 (`text-small font-medium`); sections are always open; added small `"..."` more button (`.ll-ib.ll-more`) toggling the `.ll-dmore` drawer, and `"+"` button (`.ll-ib`) for addable sections (Fill, Stroke, Effects, Animation, Data, Logic, Accessibility); removed dashed placeholder boxes when empty.
- `src/editor/shell/right-panel/RightPanelHeader.tsx`: Replaced `IconButton` `MoreHorizontal` with text glyph `"..."` matching `.rmore`. Status chips row (`.ll-rstat`) now renders conditionally only when `statusChips.length > 0` (hidden by default for headline, matching prototype).
- `src/editor/shell/right-panel/RightPanelAiChat.tsx`: Added visible focus ring to the AI chat input (`ll:focus-visible:border-border-active ll:focus-visible:ring-1 ll:focus-visible:ring-border-active`) satisfying UI Rule §8.
- `src/editor/shell/right-panel/RightPanelFrame.tsx`: Wired fallback to `useSelectionInspector()` so that when `RightPanelConnected` does not pass `selectionName`, `selectionIcon`, or `statusChips`, the frame automatically resolves them from active selection. Properly renders `moreContent` drawers and `onAdd` across design sections.
- `src/editor/panels/details/controls/AlignBar.tsx`: Converted to single segmented `.ll-dgroup` toolbar matching prototype with 6 flex-1 buttons (align left, horizontal center, right, top, vertical center, bottom) and 3 distribution buttons when `isMulti`.
- `src/editor/panels/details/sections/PositionSection.tsx`: Removed internal `"Transform & Offset"` sub-label and button; exported `PositionMore` for the header more drawer; values now show real numbers (X: 36, Y: 70, R: 0).
- `src/editor/panels/details/sections/LayoutSection.tsx`: Rebuilt layout section with `isFrame` branching: non-frame elements (like headline text layer) only show W, H, Width sizing, Height sizing, and clip content toggle. Suppresses `Free/Stack/Grid`, alignment grid, and gap/padding when inspecting non-frame elements; removed `"Constraints & Spacing"` sub-label; exported `LayoutMore`.
- `src/editor/panels/details/sections/AppearanceSection.tsx`: Cleaned 2-column grid (Opacity %, Radius); removed `"Corners & Compositing"` sub-label; exported `AppearanceMore`.
- `src/editor/panels/details/sections/TypographySection.tsx`: Removed redundant text label above textarea; displays Geist font select, 600 Semi weight, size 30, line height 1.05, tracking -0.03, 3 text alignments, and 3 sizing modes (Auto width, Auto height, Fixed); exported `TypographyMore`.
- `src/editor/panels/details/sections/FillSection.tsx`: Cleaned repeatable fill row (grip, lead swatch, hex `FFFFFF`, opacity `100%`, eye, minus); removed internal "+ Add Fill" header.
- `src/editor/panels/details/sections/StrokeSection.tsx`: Cleaned repeatable stroke row; starts empty by default matching prototype; wires `onAddStrokeRef`.
- `src/editor/panels/details/sections/EffectsSection.tsx`: Cleaned repeatable effects row; starts empty by default matching prototype; wires `onAddEffectRef`.
- `src/editor/panels/details/sections/AnimationSection.tsx`: Cleaned repeatable animation row; starts empty by default (fixing spurious "Animated" chips appearing in header); wires `onAddAnimationRef`.
- `src/editor/panels/details/sections/DataSection.tsx`: Cleaned repeatable data row; starts empty by default; wires `onAddDataRef`.
- `src/editor/panels/details/sections/LogicSection.tsx`: Cleaned repeatable logic row; starts empty by default; wires `onAddLogicRef`.
- `src/editor/panels/details/sections/AccessibilitySection.tsx`: Starts empty by default; wires `onAddA11yRef`.
- `src/editor/panels/details/sections/PageSection.tsx`: Exported `PageSectionBody`, `PageBackgroundBody`, `ThemeTokensBody`, and `ThemeTokensMore` for the Page inspector empty state.
- `src/editor/panels/details/DetailsInspector.tsx`: Rewired `getInspectorDesignSections` to return the 3 Page inspector sections when `!hasSelection`, and the 11 element sections with their header actions and `moreContent` drawers when an element is selected. Replaced `PanelSection` with `RightPanelSection`.
- `src/editor/panels/details/index.ts`: Re-exported `PositionMore`, `LayoutMore`, `AppearanceMore`, `TypographyMore`, `PageSectionBody`, `PageBackgroundBody`, `ThemeTokensBody`, and `ThemeTokensMore`.
- `src/editor/panels/details/DetailsLabView.tsx`: Updated `designSections` in the details lab to include `moreContent`, `onAdd`, and full Page settings empty state.

## Difference List (Parity Audit & Verification)

| Item | Prototype Reference | Before Fix | After Fix | Verified In |
|---|---|---|---|---|
| **1. Section Headers** | Plain title ("Position", "Layout", "Appearance", "Typography", "Fill", "Stroke", "Effects") with a small "…" button (`.ll-ib.ll-more`) on the right, **no chevron, no sub-label** ("TRANSFORM & OFFSET", "CONSTRAINTS & SPACING" do not exist in the prototype), thin dividers and generous padding. Fill, Stroke, and Effects show a "+" add button on the header instead. Sections are always open. | Accordion sections with chevron icons, collapsible titles, sub-labels ("TRANSFORM & OFFSET", "CONSTRAINTS & SPACING"), dashed placeholder boxes when empty, no "+" add button on headers. | Exact `.dtitle` match: plain 13px 500 title, sections always open, "+" add button on repeatable sections, "…" button toggles prototype `.ll-dmore` drawer, zero sub-labels or chevrons. | `app-after-panel.png`, `app-after.png` |
| **2. Header** | Shows the selected element's **type icon** (T for text, frame icon, box, image...) and name at 18px (`text-base font-semibold`), eye visibility button, and "…" text glyph button (`.rmore`). No "Animated / Data bound" chips row unless the element has active animations or bindings. | Static generic icon, 13px title, Lucide `MoreHorizontal` icon, spurious "Animated" status chips row permanently displayed. | Dynamic archetype icon (`Type` for text headline, `Frame` for frame, `Square` for button), 18px title, "…" text glyph, status chips row hidden when 0 chips. | `app-after-panel.png`, `app-after.png` |
| **3. Fields** | Position: align row (6 icon buttons in one segmented toolbar), then X (36), Y (70), R (0) fields. Layout: W (340) and H (82) fields, Hug/Fixed sizing with crop toggle on right; non-frame text elements do NOT show Free/Stack/Grid or alignment grid. Appearance: opacity (100) and radius (0). Typography: text content box ("Design it once. Ship it lazily."), Geist, 600 Semi, 30, line height 1.05, tracking -0.03, 3 alignments, size mode row. Fill: swatch, hex (FFFFFF), opacity (100%), eye, minus. Stroke/Effects/Animation: empty by default. | Showed "Mixed" values across all fields, displayed "Free / Stack / Grid" switch and 3x3 alignment grid on text layer, missing leading labels/icons, fake mock stroke/effects/animation rows. | Exact prototype fields: 6-button segmented align bar, X: 36, Y: 70, R: 0, W: 340, H: 82, Opacity: 100%, Radius: 0, Geist 600 Semi 30px, FFFFFF 100% fill. Non-frame elements hide container grid. | `app-after-panel.png`, `app-after.png` |
| **4. Data & Empty State** | Values come from real selected element. Initial Headline selection shows real values (X: 36, Y: 70, etc.). With nothing selected, displays Page inspector empty state (Page dimensions, Background, Theme & tokens). | Selection store had "headline" selected, but document store layers only had "el_root_container", causing all fields to read `null` and display "Mixed". Deselecting did not render Page inspector. | `useSelectionInspector` resolves prototype stage elements directly (`PROTOTYPE_ELEMENTS`) when not yet in document layers, syncing real values instantly. Deselecting renders Page, Background, and Theme & tokens sections. | `app-after-panel.png`, `app-after-page-empty.png` |
| **5. AI Chat Focus Ring & Header More Glyph** | Header more button uses "…" glyph matching `.rmore`. AI chat input has a visible focus ring satisfying UI Rule §8. | Header used `MoreHorizontal` Lucide icon. AI chat input had no visible focus ring on focus. | Header more button renders "…" text glyph (`.rmore`). AI chat textarea has visible `ring-1 ring-border-active border-border-active` on focus. | `app-after-panel.png`, `app-after.png` |

## Decisions made
- **Prototype Element Resolution Fallback**: Just as `Stage.tsx` detects initial unpositioned documents and renders `SAMPLE_STAGE_ELEMENTS`, `useSelectionInspector.ts` maps initial elements (`"headline"`, `"subhead"`, `"cta"`, `"hero-image"`, `"hero"`, `"features"`, `"footer"`) to `PROTOTYPE_ELEMENTS` containing exact prototype metrics (`X: 36, Y: 70, W: 340, H: 82, Opacity: 1, Radius: 0, Geist, 600 Semi, 30, 1.05, -0.03, #FFFFFF`). When custom user-created layers exist in `useDocumentStore`, it dynamically reads and writes live document properties.
- **Section Headers Always Open with More Drawer**: In the prototype, inspector sections are never collapsible (no chevron, no click-to-collapse title). Only the `...` more drawer collapses/expands. Kept sections always open and wired the `...` button to toggle the `.ll-dmore` drawer.
- **Frame vs Non-Frame Layout Branching**: Non-frame elements (like text headline) only show Width, Height, Width sizing, Height sizing, and clip content toggle. Container layout switches (`Free/Stack/Grid`), the 3x3 alignment grid, and padding/gap are only displayed when `isFrame` is true (`archetype === "container"` or `"frame"`).
- **Default Empty Repeatable Sections**: Initialized Stroke, Effects, Animation, Data, Logic, and Accessibility sections as empty lists (`[]`) matching the prototype, and wired their "+" header buttons to add new rows interactively.

## Components from other sites
- none

## Legacy behaviour dropped
- none

## Tokens / palette touched
- Used existing semantic theme tokens: `--ll-size-header-h` (44px), `--ll-radius-sm` (4px), `--ll-surface-panel`, `--ll-surface-bar`, `--ll-surface-canvas`, `--ll-surface-hover`, `--ll-border`, `--ll-border-active`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`, `--ll-select-bg`, `--ll-select-fg`, `--ll-control-primary-bg`, `--ll-control-primary-fg`.

## Integration notes added
- `RightPanelFrame` automatic selection resolution: If `selectionName`, `selectionIcon`, or `statusChips` are not explicitly passed via props, `RightPanelFrame` queries `useSelectionInspector()` as a graceful fallback.
- Bidirectional inspector selection synchronization: Inspector reads active selection from `useSelectionStore`. Clicking elements on the canvas or rows in the layer tree updates the selection store, immediately updating the inspector fields, archetype icon, and section visibility.
- Page inspector fallback: When selection is cleared (`selectedIds.length === 0`), `DetailsInspector` dynamically returns the Page settings, Background, and Theme & tokens sections.

## Not done / blocked
- none

## Phase checks
- typecheck: passed (0 errors across the entire repository).
  `npx tsc --noEmit` full output:
  ```
  (clean exit code 0, no errors)
  ```
- lint: not run (batch rule: run once at phase end)
- build: not run (dev server active on port 3000)
- Playwright: passed (captured full verification suite at 1440, 1024, 390 viewports, right panel element, page empty state, and design system labs)

## Screenshots
- `DOCS/UI/handoffs/screenshots/parity-right-panel/app-after.png`: Full app in Design mode at 1440x900 showing Headline selected, Type icon, exact coordinates and typography values (no "Mixed" values), and AI chat input with focus ring.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/app-after-panel.png`: Element capture of the right panel showing `.dtitle` section headers without chevrons or sub-labels, segmented align bar, and repeatable fill row.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/app-after-page-empty.png`: Right panel when no element is selected, showing Page settings, Background, and Theme & tokens sections.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/app-after-1024.png`: Full editor responsive layout at 1024x768 viewport.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/app-after-390.png`: Full editor responsive layout at 390x844 mobile viewport.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/after-ds-right-panel.png`: Design System Right Panel Lab at `/design-system/right-panel`.
- `DOCS/UI/handoffs/screenshots/parity-right-panel/after-ds-details.png`: Design System Details Inspector Lab at `/design-system/details`.

## Watcher verdict
<!-- Claude fills this in. -->
- [ ] Pass   - [ ] Fail (reason):
