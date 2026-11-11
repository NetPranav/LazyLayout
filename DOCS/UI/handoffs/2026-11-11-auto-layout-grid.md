# Auto layout and grid UI (2026-11-11)

## Built
- `src/editor/stage/layout-overlay/`: LayoutOverlay (padding bands, gap strips, grid tracks, chips), FlowDropLine, flowDrop, useValueDrag, usePresence (press spring, respects isMotionOff), spacingScale, gridTracks.
- Mounted in `Artboard.tsx` below the selection handles. Only a thin edge zone, gap strips and track handles take the pointer (`data-layout-grab`, excluded from the Stage marquee in `Stage.tsx`); layer middles stay the layer's.
- `useStageTransform.ts`: dragging inside a stack or grid reorders (moveLayers) instead of popping the layer out; leaving the frame keeps the old free move.
- `LayoutSection.tsx`: Free/Row/Column/Grid control, alignment grid now direction-aware (column swaps axes), wrap beside distribution, Grow/Shrink/Self for stack children, column/row span for grid children. `LayoutOptions.tsx`: hides Self/Grow/Shrink for stack children (moved to main).
- Layers tree: row/column/grid icon (`LayerItem.layout`).
- Shift+A and Alt+Shift+A already existed as engine commands; checked in the browser.

## Browser-checked (headless, 50% and 166% zoom)
Bands, gap strips and chips; padding drag (pair, Shift all, Alt one) and gap drag with undo; panel direction and alignment follow the canvas (column and row); no lag between gap strip and children; reorder drag with insertion line and undo; Grow/Shrink/Self and span fields appear; grid: tracks, add column, track drag (fr redistribution) and undo; Shift+A and Alt+Shift+A. Screenshots: `screenshots/auto-layout/`.

## Code-checked only
Motion-off path in usePresence; row add (+) on the grid; 200% zoom (166% tested).

## Not done / notes
- Default padding drag moves the opposite pair to the same value (spec gave Shift and Alt only), which overwrites an asymmetric opposite side.
- Grid drop shows the insertion line only, no cell outline; no track removal; no gap strips on wrapped stacks. See INTEGRATION.md "Auto layout and grid".
- tsc clean; eslint: no errors in my files (other files carry existing warnings).
