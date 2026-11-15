### Phase 125 (Text in shapes & typography depth)

#### Added
- **Text that fills a shape** (`text.shape`; `core/text/textShape.ts`):
  - the outline is cut into rows, and the text wraps between two CSS floats whose `shape-outside` polygons follow the rows' edges, live on the stage and in the export;
  - an inset, and the first line starts where the shape is six ems wide;
  - commands `text.fillShape`, `text.setShapeInset`, `text.releaseShape`.
- **Columns** (`typography.columns`, `typography.columnGap`).
- A **Type details** section:
  - OpenType features as checkboxes;
  - a stylistic set (1–20) and small caps;
  - the font's variable axes as sliders, and **on the canvas** as a bar over the text;
  - fill shape, inset, take out of shape;
  - columns.
- The weight slider writes the exact `wght` variation and the nearest hundred as the weight.
- `textShape.test.ts` (5 tests) and `tests/e2e/text-in-shapes.spec.ts`.

#### Fixed
- Editing a text in place lost its styled ranges. The new editor's editor offered bold, italic, underline and strike but saved only the plain words. It now shows the ranges, toggles them (Ctrl+B, I, U, Shift+X) and saves `content.runs`.

#### Not done
- Text that doesn't fit runs on below the shape, clipped. There is no overflow marker.
- No per-range font size or family.
- Firefox and WebKit not run locally.
