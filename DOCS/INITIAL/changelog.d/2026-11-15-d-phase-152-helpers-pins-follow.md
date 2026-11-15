# Stage 4 · Phase 152 · Helpers, pins & Follow

- **Scope:** Implemented Phase 152 in Lane D (`d/phase-152-helpers-pins-follow`) stacked on `d/phase-151-state-machines`.
- **Core (`src/core/bindings/helpersAndFollow.ts`):**
  - Added `isHelperLayer` & `filterExportableLayers` so helper layers run live in stage/export evaluation while remaining absent from exported DOM.
  - Added `evaluateLayerPinTarget` for `L.position(pin)` across all 9 preset pins under rotation/scale poses, and `getFollowSimpleFaceSpec` (9 clickable pin dots + Bounce/Time).
  - Added `stepFollowComponent` with target selection (pointer or layer pin), offset, Bounce/Time perceptual spring lag, axis locking, bounds clamping, leave behaviour (`stay`/`returnHome`/`coast`), velocity auto-rotation, scale-by-speed, touch policy, and `prefers-reduced-motion` policy.
- **Audit & Docs:** Updated `AUD-56` progress in `DOCS/INITIAL/AUDIT.md` and marked Phase 152 `🚧` in `DOCS/INITIAL/ROADMAP.md`.
- **Tests:** Added `src/core/bindings/__tests__/helpersAndFollow.test.ts` (scheduled for Milestone 3 batch verification at Phase 161 per 10-phase cadence).
