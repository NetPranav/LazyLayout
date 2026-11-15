# Decision 0016: Scene Rasteriser (Phase 172)

**Status:** Decided & Implemented (`Lane D`, Stage 4 Phase 172).  
**Law:** 11 (Same render definitions govern stage DOM/SVG/canvas and pixel capture).

## 1. Options Evaluated
1. **SVG `foreignObject` DOM snapshot**: Wraps rendered DOM subtrees inside `<svg><foreignObject>` and draws into `<canvas>`.
   - Rejected for core rasterisation: browser engines disagree on custom font inlining, CSS filters, `backdrop-filter`, and CORS/tainted canvas rules (`SecurityError` in Safari/WebKit when external assets or computed styles are embedded).
2. **In-house deterministic primitive rasteriser from render definitions (Chosen)**:
   - Reads the exact canonical render definitions (`fills`, `strokes`, `cornerRadius`, `masks`, `effects`, `typography`, `groups`) shared by the stage renderer and paints into an offscreen/RGBA tile buffer with per-layer version stamps and dirty-region invalidation.
   - Guarantees zero browser-specific tainting, reproducible CPU/GPU pixel output across Chromium/Firefox/WebKit, and incremental dirty redraws well under 16 ms for 1440 × 900 compositions.

## 2. Architecture
- `src/core/gpu/sceneRasteriser.ts`:
  - `rasteriseLayerToBuffer` / `createSceneRasteriserCache` maintain cached per-layer RGBA tiles keyed by layer content hash.
  - Editing a single layer marks only that layer + overlapping region dirty instead of clearing all layers.
  - Exposes `exportSelectionAsBitmap` and `MeasureDiffPercent` helpers verified against 30 gallery cases.
