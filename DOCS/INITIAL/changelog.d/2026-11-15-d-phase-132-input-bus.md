### Added (Lane D, Stage 4)
- **Phase 132 (Unified input bus & coordinate spaces):** Added `src/core/signals/inputBus.ts` with single-listener passive host sampling (`createHostInputBus`), per-frame immutable `InputSnapshot` latching on the scheduler `input` phase, and coordinate-space transformations (`convertPagePoint`) across `local`/`layer-local`, `parent`, `frame`, and `page` in `px`, `uv`, and `ndc` (including rotated bounds).
- Updated `src/core/bindings/inputBus.ts` so `pointerIn` honors `s.space` (`local`, `parent`, `frame`, `page`) via measured rects even when `pointer-events: none` is set.
- Recorded Lane D (Stage 4: Phases 132–202, `d/` branch prefix) in `DOCS/TEAM/COLLABORATION.md` and claimed Decision Records `0006`, `0012`, and `0016` in `DOCS/TEAM/CLAIMS.md`.
