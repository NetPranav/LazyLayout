### Phase 120 (Brushes & pen pressure): a brush tool whose strokes thin and thicken with the pen

#### Added
- **Pen input into width** (`core/paths/penInput.ts`):
  - pressure, tilt or speed turned into a width profile, smoothed along the stroke;
  - "Auto" uses pressure for a pen and speed for a mouse (faster is thinner).
- **Brush tool**: in the Pen flyout, shortcut **B**. It stays the tool from stroke to stroke. A settings bar sets:
  - size and colour;
  - the brush: plain, or the stretch and scatter brushes;
  - what drives the width;
  - smoothing.
- The pencil keeps a pen's pressure as a width profile; a mouse's pencil stroke is unchanged.
- The canvas reads every coalesced pointer sample and the pen's tilt.
- `penInput.test.ts` (7 tests) and `tests/e2e/brush-pressure.spec.ts` (a recorded pen stroke played back, compared with its expected path and profile).

#### Fixed
- The canvas's tool handler took presses from anything React portals through it, such as a Select's list opened from a bar over the canvas. Presses outside the stage's own DOM are no longer strokes.

#### Not done
- Firefox and WebKit not run locally; CI runs them against the same expected result.
- No custom brushes made from a layer.
- The draft preview while drawing is a thin line, not the final width.
