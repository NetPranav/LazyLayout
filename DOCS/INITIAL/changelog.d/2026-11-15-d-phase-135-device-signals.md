### Added (Lane D, Stage 4)
- **Phase 135 (Microphone, camera, gamepad & tilt):** Created `src/core/signals/deviceSignals.ts` with permission-gated analyzers for microphone (`level`, `bass`, `mid`, `treble`, `beat`), local camera (`brightness`, `motion`), gamepad (`stickLX/LY/RX/RY`, `buttons`), and device tilt (`tiltX/Y`, `orientation` with zero-calibration).
- Wired `device` and `audio` readers into `src/core/bindings/inputBus.ts` (`busFrame`) and added `src/core/signals/__tests__/deviceSignals.test.ts`.
