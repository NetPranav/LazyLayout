### Phase 73 (Parenting & helper layers): link a layer to an invisible null and it follows

#### Added
- **Parenting independent of the layer tree** (`layer.parentRef`, `src/core/geometry/parentTransforms.ts`): a layer follows another layer's transform without being inside it. Chains up to 32 deep, cycles refused, the kernel composes the parents' transforms (a 3-level chain matches the stage). Re-parenting keeps the layer where it is on screen; deleting a parent keeps its children where they were.
- **Helper layers** (`render.role: helper`, the After Effects null): drawn dashed with a badge in Design mode, and never in Preview or export.
- The new editor's timeline lanes are projected from the document (`syncDocumentToMotion`), and the stage evaluates `evaluate()` at the playhead for exact motion.
- Tests: `parentTransforms.test.ts`, `parentEvaluation.test.ts`, the helper-exclusion tests and `tests/e2e/parenting.spec.ts` (a helper draws dashed in Design and is absent from the Preview DOM; a rotating parent rotates its child).

#### Not done
- **There is no way yet to make a helper layer or set a parent from the new editor's UI** (no pick-whip, no menu). The engine and the stage handle them; the browser spec makes them through the document. Wiring it in is Lane A's job in `DOCS/UI/WIRING-53-80.md`.
