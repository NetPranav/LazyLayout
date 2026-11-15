### Added (Lane D, Stage 4)
- **Phase 134 (Scene awareness):** Added `src/core/signals/sceneAwareness.ts` computing per-layer `self.*` signals (position, size, rotation across `local`/`parent`/`frame`/`page`, velocity/speed, viewport visibility & progress, distance/angle to pointer, hover/press/focus/dragged) and layer-to-layer `distanceTo` / `angleTo` / `overlap` lazily for watched layers only.
- Added a collapsible **Live readout** panel inside `src/editor/panels/details/sections/DrivenBySection.tsx`.
- Added unit tests in `src/core/signals/__tests__/sceneAwareness.test.ts`.
