### Phase 108 (Soft union: gooey groups): union groups melt together by a softness

#### Added
- `boolean.softness` on live boolean groups: a union group's children melt together where they come within twice the softness (a morphological closing, `softClose` in `core/paths/pathTools.ts`). Always a computed path, so it needs no filter and exports as one SVG path.
- A **Boolean group** section in the new editor's inspector: operation, Softness, Flatten (Phase 104's live groups had no controls there).
- `softUnion.test.ts` (two circles at five distances against the exact neck area) and `tests/e2e/soft-union.spec.ts`.

#### Fixed
- Enter or Escape in an inspector number field also ran the canvas shortcut: committing a value on a selected group or frame selected its children.

#### Known issue (not Lane C's)
- `offsetPolygon` (`core/3d/path/offset.ts`, 3D-027) shrinks inner corners wrongly (an L shape eroded by 10: 4000 px², exact 3921.46).

#### Not done
- A soft group takes 55–135 ms to recompute; Firefox and WebKit not run.
