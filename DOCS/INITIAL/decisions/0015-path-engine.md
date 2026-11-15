# Decision 0015: The path engine (Phase 103) — in-house, curves refitted onto a polygon clipper

**Status: written 2026-11-14.** **Owner:** Lane C (Stage 3, Design depth). **Law:** 7 (licensing), 5 (real-environment verification).

## 1. The decision
- **In-house, with no new dependency.** Booleans are still combined by `polygon-clipping` (MIT, already recorded), on curves flattened to 0.002 px. A new step, `src/core/paths/curveRefit.ts`, turns the answer back into curves: every edge of a result ring lies on one segment of an input path, so a run of edges on the same segment is that segment between two parameters, cut exactly. Where two inputs cross, the joint is refined onto the true crossing by Newton's method.
- **So results keep curves as curves.** A union of two circles is 6 to 10 cubic pieces of the circles, not hundreds of lines. A straight input stays one line per side.
- **One entry point.** `booleanPaths`, `simplifyPath`, `arrangementFaces` and `unionFaces` in `src/core/paths/pathOps.ts` all return refitted curves, so live boolean groups, the Shape Builder, the paint bucket and Phase 40's Union, Subtract, Intersect and Exclude (`booleanLayers`) share it.

## 2. Why not the others
| Option | Why not |
|---|---|
| paper.js (MIT) | About 220 KB minified for the whole library; its boolean code is not separable, and it needs its own path objects on both sides. |
| Skia PathKit (BSD, Wasm) | About 400 KB of Wasm loaded before the first boolean; an asynchronous start in a core that is synchronous and pure (decision 0001 kept Wasm out of the editor core). |
| A full curve–curve sweep-line of our own | Weeks of work on degenerate cases (tangent curves, overlapping edges) that the polygon clipper already handles. The refit gets the same output for the cases the gate measures. |

## 3. What it does not do
- **Tangent and overlapping curves.** Where two inputs touch without crossing, or share an edge, the joint stays the polygon's vertex (within 0.002 px of both curves) instead of an exact crossing.
- **Offsets and outlines** are Phase 106: an offset curve is not a piece of an input curve, so it needs fitting, not refitting.
- **Speed.** The refit costs one nearest-point search per result edge. Phase 104's 16 ms budget for a 50-child group is measured there.

## 4. The gate
`src/core/paths/__tests__/curveRefit.test.ts`: 200 seeded random cases (ellipses, rectangles and smooth blobs; the four operations) against a polygon reference. Every point of the fitted outline is within 0.25 px of the reference, and the node count is bounded by the input segments that show in the result.
