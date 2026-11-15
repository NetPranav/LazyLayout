### Phase 103 (Curve-exact path engine): booleans keep curves as curves

Lane C (Stage 3, Design depth) starts here. Union, Subtract, Intersect and Exclude used to return polygons: a union of two circles was hundreds of straight pieces. They now return pieces of the shapes' own curves.

#### Added
- `src/core/paths/curveRefit.ts`: turns the polygon clipper's result back into curves. Each run of result edges on one input segment becomes that segment cut between two parameters; joints where two inputs cross are refined onto the true crossing.
- `bezToSubPaths` in `src/core/paths/bezBridge.ts` (a curve path back to editable nodes with handles).
- Decision 0015 (path engine): in-house, no new dependency.

#### Changed
- `booleanPaths`, `simplifyPath`, `arrangementFaces` and `unionFaces` return curves, so live boolean groups, the Shape Builder and the paint bucket do too.
- Phase 40's `booleanLayers` uses the same engine; a result with one outline stays an editable path with its handles.

#### Not done
- Tangent and overlapping curves keep the polygon's vertex at the joint. Firefox and WebKit were not run locally.
