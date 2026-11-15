### Phase 114 (Paint depth II): noise, grain and pattern fills

#### Added
- `noise` and `pattern` paints (`core/paint/procedural.ts`): seeded grain or soft noise; shapes repeated as a tile made from a layer. Drawn as one generated SVG for frames, shapes and the export alike.
- Noise and Pattern in the fill popover of the new editor.
- `procedural.test.ts` and `tests/e2e/procedural-fills.spec.ts` (canvas against the exported site: 0.00% of pixels differ).

#### Changed
- `devmode/inspect.ts`, `paint/gradientHandles.ts`, `paint/paintEdits.ts` and the legacy `PaintEditor.tsx` (types only) know the new paints.

#### Not done
- A pattern's tile doesn't follow later edits to its source layer (Phase 116); Firefox and WebKit not run.
