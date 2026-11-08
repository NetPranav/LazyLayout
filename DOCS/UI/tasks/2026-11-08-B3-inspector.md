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
