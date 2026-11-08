# Task B3: inspector

Read `DOCS/UI/tasks/2026-11-08-COMMON.md` first. Wave B, parallel.

## Goal
Right panel gets the sliders-button options, Mixed values, multi-layer header, hairline fields and the Canvas settings layout.

## Read only these
P: `dsec()` in the main script (grep `function dsec`), `typoSec`, `renderIns`, `rstackSync`, CSS `.llm-*` (553-564), `#vpop` markup and CSS (grep `id="vpop"`), `<script id="ll-more">` 2232-2661 (section options map), `<script id="ll-secic">` 2662-2675. App: `src/editor/panels/details/**`, `src/editor/shell/right-panel/**`, `src/core/inspector/{proModel,proRead,simpleOps}.ts`, `components/{NumberField,PanelSection,PropertyRow,Select}.tsx` (read only).

## Behaviour
- **Sliders icon button** on the right of each section header that has extra fields (same slot as Fill's `+`); opens `OptionsPopover` (B1: import from `@/editor/components/OptionsPopover`; Wave A left a placeholder, B1 replaces it) with the section's extra fields. Alt+click on a field opens its section's popover.
- **Mixed:** with several layers selected the header reads "N layers" with ONE multi-layer icon; fields show `Mixed` (shimmer) where values differ; typing applies to all selected layers (existing commands).
- Fields on floating surfaces have a hairline outline.
- **Canvas settings (`#vpop`)**: 320px, groups Grid, Snapping, Canvas, Behaviour, Appearance separated by hairlines; no scroll jump while it springs open; reopens at the top. `shell/canvas-chrome/ViewOptionsPopover.tsx` is owned by B5: do NOT edit it; list needed changes in your handoff.
- Fill/colour swatches open `ColorPicker` and the Font family field opens `FontPicker` (B1). Do not edit `ColorSwatchField`; use its props or list a need for B9.
- Binding: `src/core/inspector` proModel/proRead/simpleOps and commands. Keep `inspector-field` testids and `data-prop`.

## Lane paths
`src/editor/panels/details/**`, `src/editor/shell/right-panel/**`, `src/editor/design-system/demos/B3Demos.tsx`, tokens only inside lane block `B3 inspector`.

## Retry 1 (watcher FAIL, fix only these)
1. `RightPanelSection.tsx` (~135-143): the options popover is broken (title overlaps a second label, a stray "Subtle" select outline, cramped over the section). Position it 8px left of the inspector like P (`proto-options-popover-warm-1440.png`), show the section title once, rows with hairline dividers. Re-shoot `app-options-popover-*` on a real layer selection (Position and Typography), Warm and Darkroom, next to P.
2. `FillSection.tsx` (~146-158, 243): the swatch now only opens ColorPicker and `RowSettingsPopover` can no longer open. Restore a separate trigger for the row settings (e.g. the sliders button) so no behaviour is lost.
3. Handoff claims `PageSection` uses ColorPicker but it does not: wire Page Background/Theme swatches in `PageSection.tsx` or remove the claim and list it under Not done. Keep ONE handoff `2026-11-08-HHMM-B3.md` (delete the duplicate).
4. Mixed on Select fields: `LayoutSection.tsx` (~196, 204 W/H Fixed) and `TypographySection.tsx` (~123 weight) must show Mixed (shimmer) when values differ; verify and re-shoot the multi-selection shot.
5. No new direct `lucide-react` imports (`RightPanelSection.tsx:4`, `useSelectionInspector.ts:15`, `B3Demos.tsx:4`): use `Icon` (missing glyph: list as a need, use closest existing icon).
6. Remove the unused `selectedCount` prop (`RightPanelHeader.tsx:32`, `RightPanelFrame.tsx:134`).
7. `RightPanelSection.tsx:56-67`: remove the `preventDefault` on Alt+pointerdown (it blocks Alt-drag scrub); rely on the click handler.
8. `tokens.css` B3 block (~1497-1507): narrow the hairline selector (drop `[role="dialog"]`) and the `[data-mixed="true"] > button` shimmer selector to the popover and field scopes of this lane. Do NOT edit INTEGRATION/PARITY/DECISIONS/DesignSystemPage/ViewOptionsPopover. Rerun `npx tsc --noEmit`. Do not commit.
