### Added (Lane D, Stage 4)
- **Phase 133 (Signal catalogue & keyboard signals):** Added `keyDown`, `keyHeld`, `keyAxis` (`arrows` | `wasd`), `keyLastPressed`, and `focusVisible` signals to `src/core/document/signals.ts` and `src/core/bindings/inputBus.ts`.
- Created `src/core/signals/catalogue.ts` declaring `unit`, `range`, `defaultValue`, and `touchBehaviour` for all built-in signals, plus `src/editor/panels/signals/SignalMetersView.tsx` for live signal readout meters.
- Added unit tests in `src/core/signals/__tests__/catalogue.test.ts`.
