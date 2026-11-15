# Stage 4 · Phase 149 · Carousels, scrollers & seamless loops

- **Scope:** Implemented Phase 149 in Lane D (`d/phase-149-carousels-loops`) stacked on `d/phase-148-constrained-drag`.
- **Core (`src/core/signals/carouselsAndLoops.ts`):**
  - Added `positiveMod`, `shortestSignedMod`, and `wrapSeamlessLoop` for seam-free coordinate wrapping over multi-minute runs without floating-point drift.
  - Added `createScrollerController` supporting drag, momentum decay, nearest-item snapping, wheel delta, arrow-key stepping, and pauseable autoplay.
  - Added `computeMarqueeStep` linking marquee velocity to `scroll.velocity` with optional scroll-direction reversal and speed clamping.
  - Added `computeCarousel3DPoses` supporting `ring`, `arc`, and `stack` 3D arrangements with depth ordering and opacity/scale falloff.
- **Tests (`src/core/signals/__tests__/carouselsAndLoops.test.ts`):** Added 10-minute / 36,000-frame seamless loop test, scroller drag/snap/wheel/keyboard/autoplay test, marquee velocity modulation test, and 3D arrangement pose tests (scheduled for Milestone 2 batch verification at Phase 151 per workflow cadence).
