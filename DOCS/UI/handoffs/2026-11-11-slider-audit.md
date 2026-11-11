# Slider audit, 2026-11-11

One shared `src/editor/components/Slider.tsx` (motion in `components/SliderMotion.ts`, CSS `.ll-sld` in `styles/tokens.css`). Shown on `/design-system` under Slider. Look follows the prototype's `.sld` (2px track, 6x14 rectangular thumb, value tag above while dragging); bar tracks (hue, opacity) are 12px with a hairline.

Props: `value`, `onChange` (continuous), `onCommit` (once per gesture, or per key press), `min/max/step`, `snapPoints`, `keyStep`, `track` (`line` | `gradient` | `checker`) + `trackBackground`, `showInput` (number field kept in sync), `unit` / `formatValue`, `disabled`, `ariaLabel`.

| File | What it controls | Implementation before | Replaced? |
|---|---|---|---|
| components/ColorPicker.tsx | Hue, Opacity bars | Hand-written pointer handlers on two divs | Yes, `track="gradient"` / `"checker"` |
| panels/timeline/TimelineFooter.tsx | Timeline zoom (log 1x to 32x) | Hand-written drag div (window listeners) | Yes, `keyStep=0.1`, bubble shows e.g. `25.1×` |
| panels/code-view/TraceView.tsx | Trace scrubber | native `input type=range` | Yes |
| panels/details/options/TypographyOptions.tsx | Weight axis | native `input type=range` | Yes |
| design-system/demos/CanvasDemos2.tsx | Demo scrub of motion path | native `input type=range` | Yes |
| shell/canvas-chrome/ViewOptionsPopover.tsx (x2) | Grid size, list edge blur | Slider (old API) | Already the component; now the new one |
| panels/details/CutoutDialog.tsx (x6) | Cutout parameters | Slider (old API) | Already the component |
| panels/inspectors/LayerInspector.tsx (x2) | Scroll preview, letters depth | Slider (old API) | Already the component |
| panels/inspectors/EasingEditor.tsx (x2) | Spring response, damping | Slider (old API) | Already the component |
| panels/details/sections/TypographySection.tsx | Letters depth | Slider (old API) | Already the component |
| design-system/demos/MotionInspectorDemos.tsx | Slider demo | Slider | Extended with commit, snap, input, bar, disabled rows |

Not sliders (checked, left alone): gradient stop markers in the ColorPicker stops bar (positional markers on a bar, click adds a stop), SB square (2D area), `setPointerCapture` in FillSection/EffectsSection (row drag-reorder), NumberField scrub, canvas/timeline overlays. Fill opacity, effect blur and gradient stop position are number fields, not sliders.

## Not changed on purpose
`shell/right-panel/**`, `OptionsPopover*`, popover motion files (another agent). No slider lives in them.

## Undo (what I found)
The new editor never calls `installGestureCoalescing(window)` (only the legacy editor does, in `useProjectFiles.ts`), so every `onChange` that hits a document command is its own undo step. Measured: one hue drag in the colour picker = about 12 undo steps (same as before this work). `onCommit` is in the Slider so callers can open one transaction, but no caller wires it yet. Fix options: install gesture coalescing in `EditorShell.tsx` (shared hot spot), or call `beginTransaction` on press and `commit` in `onCommit`. Left to the owner.
