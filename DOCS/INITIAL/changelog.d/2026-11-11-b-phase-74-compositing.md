### Phase 74 (Blend modes, adjustment layers, masks & mattes): a title revealed through an animated mask

#### Fixed
- **Blend modes were never drawn.** The inspector stored `appearance.blendMode` but the stage and the export didn't write `mix-blend-mode`, so choosing Multiply did nothing. `appearance.backdropFilter` wasn't drawn either. Both are now.

#### Added
- `src/core/render/compositing.ts`: pure functions from a layer's properties to CSS, used by the render definitions (stage and export) and by the animation engine's style writer, so an animated effect is drawn by the same code as a still one.
- **Blend and isolation:** the 16 CSS blend modes; `appearance.isolation: isolate` makes a layer a group whose insides blend only with each other.
- **Adjustment layers:** `adjust.blur`, `brightness`, `contrast`, `saturate`, `hueRotate`, `grayscale`, `sepia` and `invert` filter what is behind the layer (CSS `backdrop-filter`), in a fixed order. A layer with `render.role: "adjustment"` is the After Effects adjustment layer. All keyframeable.
- **Masks:** `mask.mode` (alpha, alpha inverted, luma, luma inverted), a rectangle, ellipse or path shape, a soft edge (`mask.feather`), growth (`mask.expansion`) and `mask.fill` (a luma mask shows as much as the shape is bright). The path morphs between keyframes. A mask is an SVG image used as `mask-image`, so it works in every browser without `mask-mode`; path data and colours are sanitised.
- A compositing reference-scene set in the stage lab ("Load 5 compositing scenes") and `tests/e2e/compositing.spec.ts`: five scenes at five times compared with `evaluate()` in the real stage, including the pixels.
- Tests: 20 unit tests (`compositing.test.ts`).

#### Not done
- A layer used as another layer's matte (the matte here is a shape described by properties). Inspector and timeline controls for isolation, adjustments and masks (Lane A wires them into the new editor). A `mask.width` of 0 means the layer's own width, so an ellipse can't grow from exactly 0. Firefox and WebKit runs (CI).
