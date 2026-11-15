### Added (Lane D, Stage 4)
- **Phase 136 (Input tapes):** Extended `src/core/bindings/tape.ts` with `createTapeRecorder` (recording pointer, scroll, key, device, and audio samples into schema-validated `InputTape`), `authorScriptedTape`, `serializeInputTape` / `deserializeInputTape`, and deterministic multi-run snapshot replay (`replayTapeExpressions`).
- Added unit tests in `src/core/bindings/__tests__/tapeStage4.test.ts` verifying JSON round-trip and 3-run byte-identical replay.
