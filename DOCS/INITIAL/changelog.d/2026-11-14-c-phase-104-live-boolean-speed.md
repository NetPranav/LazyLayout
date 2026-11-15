### Phase 104 (Live boolean groups): a 50-child group updates in under 16 ms

Live boolean groups were built by the FigCraft port. This closes their speed gate, which the curve-exact engine of Phase 103 had made worse.

#### Changed
- `booleanGroupResult` (`src/core/editing/layerOutline.ts`) combines the operands as polygons and turns the result into curves once. Operands that combine the same way, one after another, are merged first; a run remembers its answer, and the answer without the child that is moving. Moving one child of a 50-child group takes 6.9 ms (it took about 45 ms before Phase 103).
- `curveRefit.ts` follows a curve from where the last edge ended instead of searching again: the refit of an 800-edge result went from 7 ms to under 1 ms.
- `pathOps.ts` exports `Region`, `mergeRegions` and `combineRegions`.

#### Not done
- No test of its own for stage against export within 0.5 px in three browsers; the Simple face has not been checked in the new editor.
