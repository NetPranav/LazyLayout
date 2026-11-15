# Changelog Fragment — Lane D · Phase 184

- Closed **`AUD-48`** in `DOCS/INITIAL/AUDIT.md` (alongside Phases 9, 139, 162–184).
- Implemented `src/core/gpu/statefulSimulations.ts`: deterministic stateful simulations across 5 modules (`stable_fluid`, `spring_lattice`, `verlet_cloth`, `metaballs_sdf`, and `rigid_bodies` backed by Phase 162 `createPhysicsWorld2D`) with tier-scaled resolution, periodic timeline snapshots, and `<= 50 ms` back-and-forth scrub seeking.
- Added unit tests in `src/core/gpu/__tests__/statefulSimulations.test.ts`.
