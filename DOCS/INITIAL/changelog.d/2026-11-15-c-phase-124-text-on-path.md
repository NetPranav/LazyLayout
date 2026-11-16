### Phase 124 (Text on a path): along any path or shape outline, edited in place

#### Added
- A **Text on path** section for text:
  - **Put on path** (a text and a shape selected);
  - Start, Side (along or the other side), Align, Spacing;
  - **Take off path**.
- A **start handle** on the canvas, dragged along the path (one undo step).
- **In-place editing**: double-click a text on a path and it updates on the curve as you type (a one-line bar above holds the caret).
- `typography.textPathStart`: the start as its own animatable number (%). The motion engine writes it as `--ll-text-path-start`, and the text follows. The path keeps the layer it came from (`source`).
- `textOnPath.test.ts` (5 tests) and `tests/e2e/text-on-path.spec.ts`.

#### Fixed
- The exporter indented the children of SVG `<text>`. The added white space became part of the text, so exported text on a path read "\n   Along…" and its glyphs moved. SVG `text`, `textPath` and `tspan` are now written inline.

#### Not done
- The text doesn't follow later edits to its source path (put it on the path again).
- An animated start isn't in the exported site yet (Phase 130).
- Firefox and WebKit not run locally.
