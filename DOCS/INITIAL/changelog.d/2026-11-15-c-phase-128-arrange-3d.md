### Phase 128 (3D arrangements for page layers)

#### Added
- **Arrange in 3D** (`core/editing/arrange3d.ts`, command `space.arrange`, an Arrange group in the 3D space section):
  - a group's children on a ring, dome, helix, sphere, cylinder, wall or stack;
  - radius, spacing, and facing out, in or at the viewer.
- The group becomes a 3D space, and each item stays a real layer with its own position, depth and turn.
- `arrange3d.test.ts` (4 tests) and `tests/e2e/arrange-3d.spec.ts`: 7 arrangements against a CSS-3D projection reference, and the export.

#### Not done
- No dragging or spinning (Stage 4).
- Firefox and WebKit not run locally.
