### Phase 52: docs match the code, and the Design panel's controls are tested

- `SCHEMA_REFERENCE.md` §0 is schema v7 (the optional asset, mode, breakpoint and 3D tables, and the v6 to v7 migration).
- `CONVENTIONS.md` and `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` are rewritten against the code (v2.0.0); the v1.1 text described files and folders that were never built.
- New end-to-end spec `tests/e2e/design-controls.spec.ts`: padding, margin, grow, fill opacity and reorder, effects, line shadow, cursor, sizing and text modes each change what is drawn.
- New end-to-end spec `tests/e2e/assets-new-editor.spec.ts`: a picture dropped on the new editor's canvas becomes an asset and an image layer, draws from the asset store, and survives a reload.
- Design panel: blend-mode, cursor and overflow options have descriptions; every segmented control shows its label as a tooltip (LA-009, LA-021).
- New end-to-end spec `tests/e2e/design-coverage.spec.ts` (Design track D2): drives every control in the Design panel for a rectangle, a frame, a text and a line, and fails on a control that changes nothing.
- Design track D3 (Style code): a **Style code** box in the Design panel. Write CSS declarations for a layer; known ones (padding, opacity, border-radius, colours, ...) set the matching controls, the rest are kept as written, drawn on the canvas and exported unchanged. Hostile input (`expression()`, `javascript:`, selectors, HTML-bearing `url()`) is refused with a line and a message. New property `style.custom` (additive); `src/core/style/styleCode.ts`.
