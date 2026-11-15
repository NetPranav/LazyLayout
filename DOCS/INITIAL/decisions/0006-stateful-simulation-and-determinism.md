# Decision 0006: Stateful Simulation and Deterministic 2D Physics

**Status:** Decided. **Date:** 2026-11-15. **Owner:** Lane D · Phase 162 (`DOCS/INITIAL/ROADMAP.md`).

## Context

LazyLayout's Law 15 requires every interactive simulation — 2D rigid bodies, joints, soft bodies, spawner debris, particle fields, and fluid/cloth effects (Phases 162–184) — to be **deterministic and seekable**. Timeline scrubbing, automated Playwright visual parity across browsers, and multi-rate evaluation (30 Hz / 60 Hz / 120 Hz) fail whenever simulation output depends on variable frame delta or unseeded entropy.

## Decision

1. **Fixed `1 / 120` s Accumulator Step:**
   All stateful 2D physics and kinetic solvers step at `FIXED_PHYSICS_DT = 1 / 120` s (8.333 ms) with an accumulator clamped at `MAX_SUBSTEPS = 8` per render tick to prevent spiral-of-death stalls while guaranteeing identical integration steps regardless of monitor refresh rate.
2. **Deterministic Order & Seeded PRNG:**
   - Broadphase uses a uniform spatial hash grid (`SpatialHashBroadphase`) that emits collision pairs sorted lexicographically by `(idA, idB)` (`idA < idB`).
   - Narrowphase uses deterministic Separating Axis Theorem (SAT) & closest-point projection with strict sorting and zero unordered `Set` iteration ambiguity.
   - Any stochastic parameter (jitter, spawner spread, Variety shuffle) draws exclusively from a 32-bit `Mulberry32` PRNG whose seed and internal state are serialized alongside simulation state.
3. **In-House Pure TypeScript Engine (No Wasm Build Dependency):**
   Consistent with Decision 0001 (No Wasm), the 2D physics engine (`src/core/physics2d/`) is pure, dependency-free TypeScript compiled identically into both the editor Stage/Preview and Next.js/Vite/Vanilla exported bundles (`physics2d` vendored module, Phase 169).
4. **Keyframe Ring Snapshots for Timeline Seeking:**
   The runtime captures immutable `PhysicsSnapshot` checkpoints every `snapshotIntervalSteps` (default 30 fixed steps = 0.25 s). Seeking to any timestamp restores the nearest preceding snapshot and steps deterministically forward for exact scrubbing Parity.

## Consequences

- Scrubbing backwards on the timeline and re-playing a scripted tape yields bit-identical body transforms `(x, y, vx, vy, angleRad, angularVel)` across runs and browsers.
- Downstream simulation phases (colliders 163, contact events 164, joints 165, soft bodies 166, spawner 170, GPU particles & fluids 183–184) inherit this fixed-step snapshot model directly.
