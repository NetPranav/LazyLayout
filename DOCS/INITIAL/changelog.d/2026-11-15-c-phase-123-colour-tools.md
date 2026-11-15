### Phase 123 (Colour tools): palettes, harmony and contrast

#### Added
- `core/paint/colorTools.ts`:
  - WCAG 2 contrast ratio and levels, and APCA Lc (APCA-W3 0.0.98G-4g);
  - the nearest passing colour, with only the OKLCH lightness moved, re-checked so it always passes;
  - harmony rules (complementary, split complementary, analogous, triad, tetrad, monochrome);
  - an 11-step tint-and-shade scale;
  - a picture's palette (deterministic k-means in OKLab).
- Saved as colour tokens named in a group (`Photo palette/1`, `Brand/500` …). Commands: `color.savePalette`, `color.harmony`, `color.scale`, `color.fixContrast`.
- A **Colour** section in the inspector:
  - Contrast with **Fix contrast** on text, against the nearest background behind it;
  - **Palette from picture** on images;
  - Harmony and **Tints & shades** for any coloured layer.
- `colorTools.test.ts` (8 tests) and `tests/e2e/colour-tools.spec.ts`. The design-coverage walker lists the section's three button settings as quiet, with their reasons.

#### Not done
- Contrast is checked against a solid background only: gradients and images behind a text are not sampled.
- Firefox and WebKit not run locally.
