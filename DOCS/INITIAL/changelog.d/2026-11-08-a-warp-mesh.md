### Warp mesh for text and pictures

Adds a multi-point control grid (2x2 up to 6x6, default 3x3 with 9 points) to bend text and image layers along curving roads and organic surfaces, extending control beyond the 4-corner pin.

#### Added
- `src/core/geometry/meshWarp.ts`: pure module providing `parseMesh`, `formatMesh`, `defaultMesh`, `cellMatrix3d`, `meshTiles`, `isMeshConvex`, and row/col line subdivision.
- Property `transform.mesh` on layers ("cols,rows;x,y;..."), taking precedence over `transform.pin` and perspective.
- Shared renderer support in `src/core/render/RenderLayer.tsx`: draws meshed layers as (cols-1)*(rows-1) tiles with 0.5px overlap to eliminate hairline seams, each clipped to its source rect and deformed with its own projective `matrix3d`.
- Position > More inspector UI in `src/editor/panels/details/sections/PositionSection.tsx`: "Warp mesh" block with grid-size selector (3x3, 4x4, 5x5), Warp / Reset / Remove mesh actions.
- Interactive canvas overlay in `src/editor/stage/WarpMeshOverlay.tsx`: rendered grid lines and handles with `aria-label="Mesh point row R column C"`, single-point drag (one undo step per gesture), Shift-drag for entire rows, convexity enforcement against fold-inversion, and double-click to subdivide lines.
- Unit test suite `src/core/geometry/__tests__/meshWarp.test.ts` verifying flat identity, cell bending, source-rect-to-quad projective mapping, and convexity.
- Playwright E2E spec `tests/e2e/new-ui-warp-mesh.spec.ts` covering mesh creation, tile counts, projective transforms, point dragging, undo, grid resizing, and mesh removal.

#### Notes & Known Limits
- Rendering uses CSS tiles with projective `matrix3d` and `clip-path`, not a native WebGL/GPU vertex mesh.
- Very large grids (e.g. > 6x6) incur higher DOM node overhead; the maximum grid is clamped to 6x6.
- The layer must be drawn by the engine (HTML/SVG/CSS), not inside an external iframe.
