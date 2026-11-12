### Phase 71 (Onion skin): ghosts of where a layer was and will be

#### Added
- **Onion skin** (the "Toggle onion skin" button in the timeline's transport row): ghost copies of the selected layer at frames before and after the playhead, each fainter the further it is from the playhead, drawn from `evaluate()`. They never take the pointer, so you can still click and drag through them.
- Ghosts stop at the composition's ends, and follow a parent's origin.
- Performance: 5 ghosts over 60 consecutive frames took 0.66 ms at the 95th percentile against a 16.6 ms frame.
- Tests: `OnionSkin.test.ts` and `tests/e2e/onion-skin.spec.ts` (the toggle; ghosts draw and the canvas stays interactive).

#### Not done
- The number of ghosts and their opacity are model settings (`onionSkinModel.ts`) but there is no control for them yet; the button turns the defaults on and off.
