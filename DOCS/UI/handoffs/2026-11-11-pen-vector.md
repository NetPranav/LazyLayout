# Handoff: Pen and Vector UI (2026-11-11)

Area: Design page, Pen / Pencil / Anchor tools and path editing. Branch `ui/redesign`, nothing committed.

## What exists
- **Toolbar** (`shell/canvas-chrome/Toolbar.tsx`): the pen glyph opens a flyout (Pen P, Pencil Shift+P, Anchor Shift+C), the same menu pattern as Shape. The button shows the last pen tool. "Pen" was removed from the Shape menu (it was duplicated). `CanvasTool` has a new `"anchor"`; Shift+P and Shift+C are bound in `useEditorActions.ts` (Shift+P used to be unreachable).
- **Draft overlay** (`stage/DraftPath.tsx`): points as small squares (last one filled), handles as lines ending in circles, dashed ghost line from the last point to the pointer, a ring on the first point once the path can close (stronger when the pointer is within the close distance). Anchors pop in on the pop spring.
- **Edit overlay** (`stage/pen/PathEditLayer.tsx`): shown only while a path is edited. Outline, squares (selected = filled), handles of the selected points, a ghost square where a click would add a point, a ring on the opposite end when an end point is selected (click it to close). Gestures: drag a point or handle (Shift locks an axis, Alt breaks a handle pair), click an outline to add a point, Shift-click multi-select, double-click a point toggles smooth/sharp. The overlay takes the pointer only on a point, a handle or the outline; a press anywhere else leaves edit mode and goes to the canvas (canvas contract §10). Enter on a selected path, the Anchor tool, or the Vector section's pen button start editing. Enter/Esc leave, Backspace/Delete remove selected points.
- **Context bar** (`stage/pen/PathContextBar.tsx`): top centre of the canvas, `.ll-ftxb` surface like the text format bar. Close path, Join, Delete point, point type (Straight / Mirrored / Free, existing SegmentedControl), Done. Draft mode shows the first three and Done. Slides in on the pop spring, fades out; no motion with `isMotionOff()`.
- **Right panel** (`panels/details/sections/VectorSection.tsx`, registered in `DetailsInspector.tsx` for `svgPath`): point type, fill rule, four boolean buttons; header round button "Edit points"; options popover: corner radius + Round, Join paths.
- **Layers** (`buildLayerTree.ts`, `LayersTree.tsx`, `left-panel/types.ts`): path rows have their own icon and a point count.
- Keys while drafting (Enter, Esc, Backspace) are now handled on `window` in `PathEditLayer.tsx`; the old handler in `Stage.tsx` needed focus on the viewport, which a canvas click never gives, so Enter did nothing. Esc now keeps the path (two points or more), like Enter.
- Fix on the way: finishing a pen draft by clicking the first point deselected the new path (the trailing click hit the artboard); `penJustFinished()` now guards that.
- New token `--ll-pen-mark` (`styles/tokens.css`): the selection ink (`--ll-text-primary`), `--ll-accent` in Lilac. In the other themes the accent is transparent, so it cannot be used directly.

## Wired vs adapter-only
- **Wired to existing engine code:** enter/leave edit, move/insert/delete points, close path, fill rule (`svg.fillRule`), union/subtract/intersect/exclude (`booleanLayers`), drafting with the pen and pencil, finishing/closing/removing the last draft point.
- **Adapter-only** (`stage/pen/penAdapter.ts`, one undo step each, no engine command): point type (derived from handles; "Free" on a mirrored point shortens its incoming handle), Round (rewrites the nodes once, not a live radius), Join (makes a new layer and deletes both, so ids and motion of the originals are lost).
- Join in the context bar needs an end point selected and another open path whose end is within 40 canvas px. Join in the options needs two open paths selected.

## Verified (headless chromium, 1440x900, Paper theme, dev server)
Flyout lists three items; pen draw with a click-drag curve; ghost line; close ring and close by click; Enter starts editing; four anchors; point select shows handles; Straight removes the handles; Delete point and Backspace remove points and update the Layers count; Enter/Esc leave and the bar hides; Shift+C enters edit on the selected path; Join of two open paths gives one path (6 points); Round turns a 3-point triangle into 6 points; no page errors. Screenshots: `handoffs/screenshots/pen/`. `tsc` and `eslint src/editor`: none from this work; the tree also has 7 lint errors (`TopBar.tsx`, `pages-manager/PagesManager.tsx`) and type errors in `pages-manager/` from another session's unfinished files.

## Not verified
Dark, Lilac and the other themes; 1024 and 390 widths; Motion and Code modes; `prefers-reduced-motion` and "disable animations"; undo of join/round as one step (written as one transaction, not exercised); touch/pen pressure; a rotated or nested path layer (uses the stage element box); the Pencil tool (unchanged); keyboard use of the flyout.

## Missing
- Engine requests: see "Pen and vector" in `DOCS/UI/INTEGRATION.md` (node type, join, live corner radius, continue path, compound paths, shared commands, anchor tool id).
- The bar, anchors and section are not on the `/design-system` page yet (UI_RULES §3).
- No e2e tests; the test ids are `path-context-bar`, `path-anchor`, `path-edit`, `path-handle`, `vector-section`, `layer-point-count`, `draft-close-ring`.
- The Point type control shows nothing selected when no point is selected (the first cell looks marked but the control is disabled).
