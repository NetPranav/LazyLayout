# Changelog Fragment — Lane D · Phase 191

- Implemented `src/core/signals/cursorOverlay.ts`: page cursor & overlay controller with 8 presets (`follower`, `blob`, `trail`, `splash`, `target_brackets`, `crosshair_measure`, `image_trail`, `button_swarm`) reading Phase 155 roles and hovered layer bounds, live only in Preview/Playground while unconditionally preserving focus rings and native cursors over text inputs, touch devices, and reduced-motion preferences.
- Added unit tests in `src/core/signals/__tests__/cursorOverlay.test.ts`.
- Verified **Milestone 6** across Phases 132–191 (`tsc --noEmit`, ESLint, Stage 4 test suites + full-repo pre-push hook, and `check-roadmap-order.mts`).
