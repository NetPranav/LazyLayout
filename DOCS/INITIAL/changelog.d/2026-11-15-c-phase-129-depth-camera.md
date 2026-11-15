### Phase 129 (Depth camera & parallax preview)

#### Added
- **A camera on a 3D space** (`camera.x`, `camera.y`, `camera.z`, `camera.focus`, `camera.aperture`).
  - Moving it moves the world the other way, so far layers move less: parallax from depth alone.
  - Depth of field blurs each layer by its distance from the focus. The space passes its camera to its children on the stage's and the export's paths alike (`RenderContext.parentCamera`).
- **Drag camera** on the canvas (pan; with Shift, dolly), and a Camera group in the 3D space section.
- Command `space.setCamera`, and the projection formula `cameraProject`.
- `camera.test.ts` (3 tests) and `tests/e2e/depth-camera.spec.ts` (10 camera positions against the formula, the export, depth of field).

#### Not done
- Bound to scroll and the cursor in Stage 4.
- Firefox and WebKit not run locally.
