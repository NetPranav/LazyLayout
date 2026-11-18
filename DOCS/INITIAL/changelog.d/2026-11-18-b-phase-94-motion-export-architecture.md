### Phase 94 (Motion export architecture): the engine code generators live with the exporters, and a plan says which engine each animation becomes

Nothing changes for anyone using the editor. The GSAP, Framer Motion and CSS generators moved out of `MultiEngineAnimationRuntime` unchanged, and a new plan reads only the document and the routing decision. Phase 95 builds on it. The phase stays in progress: Phase 68 and Phase 49's harness are Lane A's.

#### Added
- `src/core/export/motion/`: `gsap.ts`, `framer.ts`, `css.ts`, `names.ts`, `types.ts` (moved) and `plan.ts` (`planMotionExport`, new).
- 8 tests, including 106 recorded outputs of the old runtime and a test that no file in the folder imports a store, the editor or React or touches the page.

#### Changed (shared hot spots)
- `src/core/engine/MultiEngineAnimationRuntime.ts`: the seven methods are now one-line calls to the moved functions; the option types and the two name helpers are re-exported from it, so every importer is unchanged.

#### Not done
- Writing the code for a document's clips (Phase 95); the runtime's other methods are style evaluators, not generators, and stay.
