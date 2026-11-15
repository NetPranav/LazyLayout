# Stage 4 · Phase 157 · Fields & effectors

- **Scope:** Implemented Phase 157 in Lane D (`d/phase-157-fields-effectors`) stacked on `d/phase-156-data-driven-charts`.
- **Core (`src/core/signals/fieldsAndEffectors.ts`):**
  - Added spatial fields (`circle`, `box`, `capsule`, `pathStroke`, `ownShape`, `linear`, `noise`) with inner/outer radius, falloff curves (`linear`, `smoothstep`, `gaussian`, `hard`), and 2D weight heatmap sampler (`buildFieldHeatmap`).
  - Added all 8 effectors (`keepOut`, `push`, `attract`, `swirl`, `transform`, `style`, `lookAt`, `jitter`) with spring-home dynamics and final hard `keepOut` projection constraint.
- **Audit & Docs:** Updated `AUD-56` progress in `DOCS/INITIAL/AUDIT.md` and marked Phase 157 `🚧` in `DOCS/INITIAL/ROADMAP.md`.
- **Tests:** Added `src/core/signals/__tests__/fieldsAndEffectors.test.ts` validating hard keepOut exclusion + < 0.5 px spring-home recovery (verified at Milestone 3).
