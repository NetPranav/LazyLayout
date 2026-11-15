### Phase 113 (Paint depth I): a blend mode and a mask per fill

#### Added
- A mask on each fill: linear, radial or conic fade, or a sibling layer's outline (inside or outside). Drawn as an SVG alpha mask on shapes; exported the same way.
- Per-fill **Blend** and **Mask** controls in the new editor's fill popover.
- `fillMasks.test.ts` and `tests/e2e/fill-masks.spec.ts` (24 references read back as pixels, within 5 of 255).

#### Not done
- Masks on frames' fills (CSS backgrounds can't mask a single layer); Firefox and WebKit not run.
