# Changelog Fragment — Lane D · Phase 190

- Implemented `src/core/scroll/depthParallax.ts`: Stage 3 perspective depth camera bound to scroll, cursor, and phone tilt with 4 presets (`multi_plane_parallax`, `dolly_on_scroll`, `cursor_look_around`, `phone_tilt`) emitting stage/export parity CSS 3D transforms across N depth planes.
- Added unit tests in `src/core/scroll/__tests__/depthParallax.test.ts`.
