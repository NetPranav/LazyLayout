# Stage 4 · Phase 158 · One evaluation space & no-maths kinetics

- **Scope:** Implemented Phase 158 in Lane D (`d/phase-158-world-space-kinetics`) stacked on `d/phase-157-fields-effectors`.
- **Core (`src/core/signals/worldSpaceKinetics.ts`):**
  - Added 2D affine world transform chain composition, inversion, and point projection (`composeLocalMatrix2D`, `multiplyMatrix2D`, `composeWorldMatrix2D`, `invertMatrix2D`, `applyMatrix2D`) so nested rotated/scaled layers evaluate fields and targets in top-level frame space (Law 10).
  - Added `"Stay inside"` world boundary clamping and plain-language no-maths kinetic Simple faces (`mapKineticSimpleFace` + `auditKineticSimpleLabels` under Law 17).
- **Tests:** Added `src/core/signals/__tests__/worldSpaceKinetics.test.ts` validating rotated/scaled card parity, Law 17 label audit, and 400-letter 60fps performance budget (verified at Milestone 3).
