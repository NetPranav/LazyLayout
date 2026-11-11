# Right panel: main body vs options popover audit (2026-11-11)

Source: `DOCS/UI/design/editor-design-mode-blocks-dark.html` (`renderIns`, `positionMore`, `layoutBody/layoutMore`, `typoSec`, `imageSec`, `statesSec`, `kindSec`). Real: `src/editor/panels/details/{sections,options}`.

| Section | Prototype main | Prototype options | Current main (after) | Current options (after) | Mismatch |
|---|---|---|---|---|---|
| Position | align bar, (distribute if multi), X, Y, Rotation | Type, Z, Offset T/R/B/L (non-static), Scale XY, Skew XY, 3D rotate XY, Origin | same as prototype | same + Perspective, Translate Z, 3D space, Role, Constraint H/V, Corner pin, Warp mesh | Constraints H/V were in the main body: MOVED to options. Perspective/Translate Z/3D space/Role were reachable nowhere (only in the unused `PositionMore`): ADDED to options (bindings existed). Corner pin / Warp mesh are engine extras, already in options. |
| Layout | mode (frame), W/H, W/H sizing, clip, stack/grid controls | Min/Max W/H, Padding, Margin, Overflow X/Y, Unit, Box; frame: Reverse, Grid template; else Self, Grow, Shrink | matches | matches | none |
| Appearance | Opacity, Corner radius | 4 corner radii, Blend, Cursor, Events | matches | matches | none |
| Typography | text content, family, weight, size, line height, tracking, align, auto-size | Case, Italic, Decoration, Word spacing, Overflow, Wrap, Font loading, Weight axis | matches (plus letters-group Depth/3D buttons, engine only) | matches | none (Letters depth is engine-only, no prototype equivalent, left in main) |
| Image | file + Replace, Fit, Alt | Focal XY, Ratio, Clip, Loading, Fallback, filters, Overlay (hex, opacity, blend) | Replace, Fit, Alt | Focal, Ratio, Loading, filters, overlay | Clip path and Fallback rows: see Missing |
| States (button) | Default/Hover/Pressed/Disabled, Background hex | Size, Type, Focus ring, Ring width, Disabled opacity, Loading label, Spinner, Ripple, Duration | matches | matches | none |
| Fill / Stroke / Effects | rows with "+" | none in prototype (per-row popovers) | rows + "+" | Fill/Stroke/Effects options exist (engine extras) | not in prototype; kept |
| Input | type, placeholder, value | Required, Read only, Pattern, Error | type, placeholder, value | Pattern, Error (+ more via InputMore) | none |
| Toggle | checked, size, active/inactive | none | same | none | none |
| Divider / Background / Icon / Shape / Counter / 3D | per `kindSec` | per `kindSec` | match | match | none found by label comparison |
| Page | name, W, H | none | same | none | none |
| Page Background | hex | none | same | none | none |
| Theme & Tokens | Primary/Surface/Text, radius, font, scale, shadow | Feedback | same | Feedback | none |

## Moved / added
- `sections/PositionSection.tsx`: removed the Constraints block (H, V selects) from the body.
- `options/PositionOptions.tsx`: added Constraint H / V (same `constraints.horizontal|vertical` paths), Perspective, Translate Z, 3D space, Role (`transform.perspective|translateZ|style3d`, `render.role`).
- `shell/right-panel/RightPanelSection.tsx`: header "+" and options buttons now `rounded-full` (user request); size, icon and colours unchanged.

## Missing (prototype has it, no binding verified, not faked)
- Image: Clip path, Fallback (not checked for a layer property; `ImageOptions` has no row for them).
- Input: Required / Read only checkboxes: not verified in `InputMore`.
- Divider/others: only label-level comparison done, not value-level.

## Not verified
- Only a Frame layer was selected in the screenshots; Typography, Image, States and kind-section popovers were not opened live.

## Row-list sections: one popover per row (options unify)
- Fill, Stroke and Effects no longer have a header sliders button. Each row's sliders button (Effects: the row's lead swatch) opens the only popover for that item.
- Stroke row popover: Colour, Position, Width | Style, Sides (5 icons) | Cap, Join, Miter, Dash. Fill: Type, Colour, Angle, Opacity | gradient Stops (add, remove, colour, position) | image Fit, Picture, Cut out. Effects: Type, Colour, X, Y, Blur, Spread, or Amount.
- All use OptionGroup/OptionRow (72px label column). Fixed a CSS rule that zeroed the gap and double-padded the last group of row popovers (tokens.css, `.ll-rowpop`).
- Layer-wide settings in the Stroke popover (Position, Cap, Join, Miter, Dash) still write the layer's single stroke properties. Cap/Join/Miter/Dash (svg.*) do not persist on a button layer; the old header had the same limit.
- Blend was in the Fill and Effects headers; it is already in Appearance, so it was dropped from the row popovers. Effects header blur/shadow lists duplicated the rows.
- Stroke edits are now one undo step; the stroke row follows undo.
- Old StrokeOptions/FillOptions/EffectsOptions are kept: the design-system demos import them.
- Screenshots: DOCS/UI/handoffs/screenshots/options-unify/.

## Row popover motion (Fill, Stroke, Effects)

Cause: `RowSettingsPopover` was its own portal (`isOpen && createPortal`), one instance per row, with no motion code, so it appeared and vanished instantly and a row switch was an unmount plus a mount.

Change: `RowSettingsPopover` is now a thin wrapper around the shared `OptionsPopover` (anchored to the row's sliders button), so open, close, slide-to-anchor and content crossfade use the same springs as the Position/Layout/Appearance popovers. `retarget.ts` gained `registerClosingOverlay`/`releaseClosingOverlay`, so a popover still playing its exit is adopted (and ended) by the next same-family popover: one element slides, never two. `OptionsPopover` now does nothing animated when `isMotionOff()` (no 100 ms fade). The three sections' `onClose` only clears their own row id, so a closing row cannot clear a newly opened one. `tokens.css`: `.ll-rowpop` body selectors no longer need a direct-child `.ll-pbody`. Header text is now "Fill options" (was "Fill"). Measurements and screenshots: `screenshots/popover-motion/`.
