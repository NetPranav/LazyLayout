# Changelog Fragment — Lane D · Phase 185

- Implemented `src/core/gpu/deformationWarpPeel.ts`: warp mesh modifiers (`envelope`, `bend`, `bulge`, `wave`, `flag`) and corner/edge curl modifiers (`sticker_peel`, `page_curl`) over Phase 175 cached layer textures while guaranteeing zero mutations to the underlying DOM accessibility tree.
- Added unit tests in `src/core/gpu/__tests__/deformationWarpPeel.test.ts`.
