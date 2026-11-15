### Phase 118 (Stroke depth): several strokes, each its own weight, position and paint

#### Added
- Per-stroke `weight` and `align` in `paint.strokes`; `StrokeStack` draws each stroke as its own layer when they differ.
- `strokeStack.test.ts` and `tests/e2e/stroke-depth.spec.ts` (30 references, canvas against export, worst 0.60%).

#### Fixed
- The inspector's Stroke section showed several rows but saved only the first; it now keeps every row for shapes, lines, paths and text, and Position is per row.

#### Not done
- Gradient and image stroke paints from the row editor; per-stroke dashes, caps and joins; Firefox and WebKit not run.
