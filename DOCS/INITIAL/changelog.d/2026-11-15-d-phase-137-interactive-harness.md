### Added (Lane D, Stage 4)
- **Phase 137 (GPU & interactive verification harness):** Created `src/core/gpu/interactiveHarness.ts` integrating deterministic `playTape` stepping, perceptual frame comparison (`compare` + `TIER_TOLERANCES` for `strict`/`real-gpu`/`software-ci`), particle centroid/count/spread statistics, and GPU ledger leak checks on teardown.
- Added pass and deliberate-falsifier verification tests in `src/core/gpu/__tests__/interactiveHarness.test.ts`.
