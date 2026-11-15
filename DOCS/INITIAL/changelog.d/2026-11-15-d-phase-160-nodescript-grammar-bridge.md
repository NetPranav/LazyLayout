# Stage 4 · Phase 160 · NodeScript text form & one model with the grammar

- **Scope:** Implemented Phase 160 in Lane D (`d/phase-160-nodescript-grammar-bridge`) stacked on `d/phase-159-blueprint-model`.
- **Core (`src/core/nodescript/interactionBridge.ts`):**
  - Unified the `Interaction.*` NodeScript namespace with `INTERACTION_NODE_CATALOG` (`toInteractionCanonicalName`, `resolveInteractionNodeSpec`).
  - Added single-model compilers `compileSimpleRuleToGraphFragment` and `compileBindingToGraphFragment` so Simple rules, bindings, and Pro Blueprints validate through the same rules engine and serialize identically to `.nls`.
  - Added `roundTripGraphViaNodeScript` and `normalizeGraphStructure`.
- **Tests:** Added `src/core/nodescript/__tests__/interactionRoundTrip.test.ts` testing 1:1 `Interaction.*` parity, Simple rule -> `.nls` -> graph parity, and 500 seeded random graph round-trips (`seed = 1..500`; verified at Milestone 3).
