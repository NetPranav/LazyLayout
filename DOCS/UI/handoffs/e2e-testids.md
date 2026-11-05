# E2E test hooks in the new editor (`/editor`)

Only `data-testid` and `data-*` attributes were added: no class, style or behaviour change. React owns these attributes; the motion engine only writes `data-mv`, `data-lv`, `data-pfx`, `data-on` and `ll-*` classes, so there is no clash. Verified by a headless run against the dev server (counts > 0 below).

## Hooks

| testid | Element | Extra attributes | Present in |
|---|---|---|---|
| `top-bar` | `<header>` | | all |
| `mode-tab` | mode switch tab | `data-mode` = design / motion / code | all |
| `save-status` | logo button (existing) | `data-state` = saved / dirty / saving / error | all |
| `left-panel` | `<aside>` Layers / Files | | all |
| `layer-tree` | tree container (`#p-layers`) | | design, motion |
| `layer-row` | one layer row (`role=treeitem`) | `data-layer-id`, `data-selected` ("true"/"false") | design, motion |
| `layer-name` | name cell inside the row | | design, motion |
| `canvas-chrome` | `<main aria-label="Canvas">` | | all |
| `stage-viewport` | stage root (`.ll-stage-viewport`, `data-stage=workspace`) | | all |
| `stage-artboard` | artboard (`data-stage=artboard`) | | all |
| `stage-element` | one stage element | `data-element-id`, `data-selected` | all |
| `selection-overlay` | transform overlay root (always present, may be empty) | | all |
| `selection-box` | box of one selected element | `data-selection-id` | when selected |
| `selection-handle` | one of 8 resize handles | `data-handle` = nw n ne e se s sw w | when selected |
| `hover-outline` | hover outline | | on hover |
| `snap-guide` | snap line while dragging | `data-axis` = x / y | during drag |
| `spacing-mark` | alt-drag distance mark | | during alt-drag |
| `canvas-context-menu` | canvas right-click menu | | right-click on the canvas (not on an element) |
| `right-panel` | inspector `<aside>` | `data-mode` | all |
| `inspector-field` | every `NumberField` | `data-prop` = aria-label or label ("X", "Y", "Rotation", ...) | design |
| `bottom-panel` | timeline or code section | | motion, code |
| `timeline-ruler` | ruler lane (click/drag = seek) | `data-pps`, `data-t0` (s), `data-fps` | motion |
| `timeline-playhead-layer` | always-rendered playhead overlay | `data-time` (frames) | motion |
| `timeline-playhead` | needle (only when in view) | `data-time` (frames) | motion |
| `timeline-lane` | layer row in the timeline | `data-layer-id`, `data-selected` | motion |
| `timeline-lane-name` | its name | | motion |
| `timeline-clip` | clip bar | `data-layer-id`, `data-clip-index`, `data-start`, `data-end` (frames); group clip has `data-group="true"` instead | motion |
| `timeline-prop-lane` | property row (layer expanded) | `data-layer-id`, `data-prop`, `data-selected` | motion |
| `timeline-prop-value` | scrubbable value readout | | motion |
| `keyframe` | keyframe diamond | `data-key-id`, `data-time` (frames), `data-prop`, `data-layer-id`, `data-selected` | motion |

## Old selector to new locator

| Old | Meant | New |
|---|---|---|
| `.dock-zone--center` (stageShot) | canvas area | `[data-testid="canvas-chrome"]` (with rulers/toolbars) or `[data-testid="stage-viewport"]` (stage only) |
| `.dock-zone--bottom` | timeline/code dock | `[data-testid="bottom-panel"]` |
| `.dock-zone--right` | inspector | `[data-testid="right-panel"]` |
| `.dock-layout`, `.dock-zone--left` | shell / layers | `[data-testid="left-panel"]` (shell root: `.ll-editor-root[data-mode]`) |
| `.whiteboard-stage`, `.canvas-frame` | stage root / frame | `stage-viewport` / `stage-artboard` |
| `[data-element-id]` | stage element | `[data-testid="stage-element"]` (same attribute kept) |
| `.canvas-overlay__selection:not([hidden])` | selection box | `selection-box` (count 0 = nothing selected) |
| `.canvas-overlay__handle[data-handle=x]` | resize handle | `selection-handle[data-handle=x]` |
| `.canvas-overlay__guide[data-axis]`, `__ghandle` | snap guide | `snap-guide[data-axis]` (the ghandle/gap handles have no equivalent) |
| `.canvas-overlay__hover` | hover outline | `hover-outline` |
| `.canvas-overlay__spacing` | spacing marks | `spacing-mark` |
| `.canvas-overlay__transform` | transform overlay | `selection-overlay` |
| `.layers-row__name` | layer name | `layer-row [data-testid="layer-name"]` |
| `[data-layer-row="id"]`, `[data-layer-row][aria-selected]` | layer row | `layer-row[data-layer-id="id"]`, `[data-selected="true"]` (`aria-selected` also set) |
| `.layers-row--drop-*` | drag-drop state | classes `ldb` / `lda` / `ldi` on the row while dragging (no testid) |
| `[data-timeline-ruler]`, `.sequencer-ruler-wrap` | ruler | `timeline-ruler` |
| `[data-timeline-row="id"]` | layer row | `timeline-lane[data-layer-id="id"]` |
| `[data-timeline-property="p"]` | property row | `timeline-prop-lane[data-prop="p"]` |
| `[data-keyframe]` | keyframe | `keyframe` |
| `[data-timeline-needle]`, `.sequencer-playhead-head` | playhead | `timeline-playhead` / `timeline-playhead-layer` |
| `[data-layer-bar]` | clip | `timeline-clip` |
| `[data-prop-path]` | inspector field | `inspector-field[data-prop]` (names differ: "X" not "frame.x") |
| `getByRole("group", { name: "Transport" })` | transport | `getByRole("toolbar", { name: "Timeline header" })` |
| `getByRole("tab", { name: /Animate/ })`, `/Design/` | mode tab | `mode-tab[data-mode=...]` |
| `getByTitle("Add keyframe at current playhead position")` | add key | `getByRole("button", { name: "Add keyframe (K)" })` (canvas toolbar) |
| `getByRole("button", { name: "Timeline tool" })` | none | open Motion with `mode-tab[data-mode="motion"]` |
| `getByRole("button", { name: "Mount Showcase Demo" })`, lab buttons | lab routes | not part of `/editor`; unchanged |

## Reading state

- Playhead time (frames): `Number(await page.getByTestId("timeline-playhead-layer").getAttribute("data-time"))`. Seconds = frames / `data-fps` (60 by default; the project default playhead is 72 = 1.2 s). Text form: `getByLabel("Playhead time")`.
- Seek on the ruler: frame f is at `x = 24 + (f / fps - t0) * pps` px from the ruler's left edge. Read `pps`, `t0`, `fps` from `data-pps`, `data-t0`, `data-fps`. Click `timeline-ruler` with `position: { x, y: 8 }`. Pixel scale is not fixed (the old 280 px/s constant is gone).
- Layer selected: `layer-row[data-layer-id=id]` has `data-selected="true"`. Timeline: `timeline-lane[...]` same. Keyframe: `keyframe[data-key-id]` `data-selected`.
- Mode: `mode-tab[aria-selected=true]` `data-mode`, or `.ll-editor-root` `data-mode`.
- Save: `save-status[data-state="saved"]`.

## Caveats (not hookable or surprising)

- The stage currently renders sample elements (3 `stage-element`s: headline / button / image). Their `data-element-id` does not match the project layer ids in `layer-row` (16 rows), and clicking a layer row does not mark a stage element selected. Selection overlays follow the stage's own state.
- Right-clicking on a stage element opens that element's own menu, not `canvas-context-menu`. Right-click blank canvas.
- `selection-handle`, `snap-guide` and `hover-outline` exist only while selected / dragging / hovered.
- Code mode hides the layer tree (the left panel shows files) and the timeline hooks.
- Old overlay parts without an equivalent: gap handles (`__ghandle`), the canvas text editor (`.canvas-text-editor`), `.panel-header__badge`, `.pro-number__label`.
