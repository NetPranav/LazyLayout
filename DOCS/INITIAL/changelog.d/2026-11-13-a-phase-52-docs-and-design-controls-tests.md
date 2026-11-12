### Phase 52: docs match the code, and the Design panel's controls are tested

- `SCHEMA_REFERENCE.md` §0 is schema v7 (the optional asset, mode, breakpoint and 3D tables, and the v6 to v7 migration).
- `CONVENTIONS.md` and `FOLDER_STRUCTURE_AND_DATA_HIERARCHY.md` are rewritten against the code (v2.0.0); the v1.1 text described files and folders that were never built.
- New end-to-end spec `tests/e2e/design-controls.spec.ts`: padding, margin, grow, fill opacity and reorder, effects, line shadow, cursor, sizing and text modes each change what is drawn.
