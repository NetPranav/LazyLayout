# Stage 4 · Phase 154 · Cloners, tags & group targets

- **Scope:** Implemented Phase 154 in Lane D (`d/phase-154-cloners-tags-groups`) stacked on `d/phase-153-split-real-layers`.
- **Core (`src/core/signals/clonersAndGroupTargets.ts`):**
  - Added deterministic `grid`, `radial`, `path`, `scatter`, and `linear` cloner generators with `index`, `count`, `progress`, `homeX`/`homeY`, `random`, and per-clone overrides.
  - Added `resolveGroupOrTagTargets` for `Group[*]` / `<groupId>[*]` and `tag:<name>` binding targets.
  - Added `CLONER_DOM_TIER_CAP = 400` detection recommending Phase 183 GPU particles for larger sets.
- **Tests:** Added `src/core/signals/__tests__/clonersAndGroupTargets.test.ts` including a 20×20 dot grid stage/export parity test (verified at Milestone 3).
