# Stage 4 · Phase 155 · Roles, relations & selectors

- **Scope:** Implemented Phase 155 in Lane D (`d/phase-155-roles-relations-selectors`) stacked on `d/phase-154-cloners-tags-groups`.
- **Core (`src/core/signals/rolesAndSelectors.ts`):**
  - Added `inferLayerRole` supporting explicit overrides and structural/name inference (`button`, `link`, `heading`, `image`, `card`, `input`, `badge`, `section`).
  - Added semantic selectors (`resolveSemanticSelector`: `"every button"`, `"the nearest card"`, `"my neighbours"`, `"the layer under the cursor"`) and pairwise `computeLayerRelation` (`centerDistancePx`, `edgeDistancePx`, `angleDeg`, `overlapAreaPx`, `overlapRatioA`, `orderDelta`).
- **Tests:** Added `src/core/signals/__tests__/rolesAndSelectors.test.ts` (10 selector fixtures + relation signals; verified at Milestone 3).
