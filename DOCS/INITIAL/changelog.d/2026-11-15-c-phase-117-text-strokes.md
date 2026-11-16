### Phase 117 (Fills & strokes on text): several strokes, any fill, still real text

#### Added
- `paint.strokes` on text, each stroke with its own `weight` and `align`; drawn by hidden copies in order around the fill, while the words stay real and are read once.
- Noise, pattern and mesh fills work on text (through `background-clip: text`).
- `textStrokes.test.ts` and `tests/e2e/text-strokes.spec.ts` (read once; canvas against export: 0.00% of pixels differ).

#### Not done
- Gradient strokes on text, true inside strokes, masks on text fills; the stroke list in the inspector (Phase 118); Firefox and WebKit not run.
