# Stage 4 · Phase 162 · 2D physics core (Decision 0006)

- **Scope:** Implemented Phase 162 in Lane D (`d/phase-162-physics2d-core`) stacked on `d/phase-161-blueprint-runtime`.
- **Decision Record (`DOCS/INITIAL/decisions/0006-stateful-simulation-and-determinism.md`):** Documented fixed `1/120 s` accumulator stepping, deterministic broadphase pair ordering, Mulberry32 PRNG state tracking, pure TypeScript runtime parity, and snapshot timeline seeking.
- **Core (`src/core/physics2d/physicsCore.ts`):**
  - Implemented `createPhysicsWorld2D`, `broadphasePairs` spatial hash, `detectSatCollision` (circle–circle, circle–box, box–box SAT), Baumgarte stabilization, Coulomb friction, and `seekToTime` snapshots.
- **Tests:** Added `src/core/physics2d/__tests__/physicsCore.test.ts` validating 200-body drop determinism across 60/120 Hz + snapshot timeline seeking (verified at Milestone 4).
