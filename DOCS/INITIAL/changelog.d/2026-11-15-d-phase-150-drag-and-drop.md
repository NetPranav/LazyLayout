# Stage 4 · Phase 150 · Drag & drop between layers

- **Scope:** Implemented Phase 150 in Lane D (`d/phase-150-drag-and-drop`) stacked on `d/phase-149-carousels-loops`.
- **Core (`src/core/signals/dragAndDrop.ts`):**
  - Added `resolveDropZone` with priority ranking and `accepts` kind filtering + local normalized hit coordinates.
  - Added `createSortableController` supporting `vertical-list`, `horizontal-list`, and multi-column `grid` reordering via pointer drag and keyboard navigation (`ArrowUp`/`ArrowDown`/`ArrowLeft`/`ArrowRight`), animated sibling interpolation (`stepAnimation`), swipe-to-remove row detection, and typed events (`pickup`, `hoverZone`, `reorder`, `drop`, `remove`, `cancel`) for rules and Blueprints.
- **Tests (`src/core/signals/__tests__/dragAndDrop.test.ts`):** Added 15-step pointer + keyboard reorder journey across list/grid, sibling animation convergence, drop zone filtering, and swipe-to-remove tests (scheduled for Milestone 2 batch verification at Phase 151 per workflow cadence).
