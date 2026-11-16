### Phase 107 (Smooth corners & corner styles): cut, scoop and inverted corners; smoothing reachable in the new editor

#### Added
- `shape.cornerStyle` (round, cut, scoop, inverted) on rectangles, polygons and stars; `styledPolygon` and `CornerStyle` in `core/geometry/shapes.ts`. The render definition, the exporter (same definition) and the outline used by booleans and the Shape Builder all draw it.
- A **Style** select and a **Smoothing** field (0–100%) under Corners in the new editor's Appearance options.
- `cornerStyles.test.ts`: 60% smoothing against an independently written reference squircle (within 0.5 px), exact areas for every style.

#### Not done
- Corner styles and smoothing on individual vector points; Firefox and WebKit not run.
