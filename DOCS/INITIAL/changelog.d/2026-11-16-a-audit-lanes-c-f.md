### Fixed (audit of Lanes C–F, 2026-11-16)
- Rig export (Phase 215): the parity check now runs the exported runtime instead of comparing the editor with itself; the exported runtime evaluates a bone's parent first.
- Code-component sandbox (Phase 195): the frame runs the bundle it is sent; a browser test shows a hostile bundle can't read the host's cookie, storage, document or network.
- Stage 4 gate (Phase 202): Journey A no longer compares a value with itself.
- 2D physics (Phase 162): free-fall, gravity and resting tests (halving gravity used to pass).
- 3D export (Phases 238–239): the R3F export writes the inner file it imports; the three.js export renders the model; scene names are made safe; no `innerHTML`.
- 3D primitives (Phase 222): sphere, cylinder, torus and capsule are real solids (they were one bulged disc).
- Stage 6 gate (Phase 240) and the 3D Studio banner: typed-in parity numbers and "227/227" removed; unmeasured items are listed and keep the gate from passing.
- Command-coverage test: the Icons & photos dialog's Escape handler is listed with the other dialogs (it failed on `main`).

### Changed
- AUDIT.md: AUD-14, 45, 46, 48, 49, 50, 54, 56 and 57 reopened as Partial or Open, with the reason; they were marked closed by code the editor doesn't use.
