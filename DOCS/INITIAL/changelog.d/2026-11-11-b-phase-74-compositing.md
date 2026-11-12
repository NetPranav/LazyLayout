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

- **Track mattes:** `matte.source`, `matte.mode`, `matte.showSource`. A layer uses another layer as its mask (alpha, luma and inverted): the source's shape, position, scale and rotation, animated, become the mask, and the source is hidden unless you ask to show it. It reads a box or ellipse on the same absolute canvas; anything else gives no matte and the source stays visible. `src/core/geometry/matteShape.ts`, `withMatte` in the kernel.
- Commands for the inspector and agents: `layer.setBlend`, `layer.setAdjustment`, `layer.setMask`, `layer.setMatte`.
- `mask.width` and `mask.height` default to -1 (the layer's own); 0 is now a real zero, so a mask can grow from nothing.
- Tests: 12 matte unit tests and 4 more compositing tests; the stage-lab spec gains a track-matte scene.

#### Not done
- The inspector and timeline controls (the commands and property paths are ready; the UI pipeline wires them, see the wiring doc). A matte whose source is under a flow layout. Masks and mattes in exported code. Firefox and WebKit runs (CI).
