### Phase 115 (Mesh gradients): colour points you drag on the canvas

#### Added
- A `mesh` paint (`core/paint/mesh.ts`): a grid of colour points, linear or smooth, rasterised into a picture that the canvas, frames, shapes and the export all draw.
- Mesh controls in the fill popover and draggable points on the canvas (`MeshOverlay.tsx`, while "On canvas" is switched on).
- `mesh.test.ts` (10 reference meshes) and `tests/e2e/mesh-gradients.spec.ts` (canvas against export: 0.00% of pixels differ; dragging a point).

#### Not done
- Per-point spread; handles on a rotated layer; Firefox and WebKit not run.
