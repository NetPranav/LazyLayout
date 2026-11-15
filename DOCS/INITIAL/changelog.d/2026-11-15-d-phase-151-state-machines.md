# Stage 4 · Phase 151 · State machines

- **Scope:** Implemented Phase 151 in Lane D (`d/phase-151-state-machines`) stacked on `d/phase-150-drag-and-drop`.
- **Core (`src/core/signals/stateMachineRuntime.ts`):**
  - Added `createStateMachineRuntime`, `evaluateBlend1D`, and `evaluateConditions` supporting typed Rive-style inputs (`boolean`, `number` with min/max bounds, `trigger` with single-fire consumption), conditional multi-clause transitions (including `"*"` any-state and priority sorting), smooth cross-state blend timing, and `blend1d` states interpolating properties from a numeric input.
- **UI (`src/editor/panels/signals/StateMachineGraphEditor.tsx`):**
  - Added compact visual state-graph editor rendering states, active transitions, live input controls (checkbox, range slider, trigger fire button), and computed output property badges using `ll:` classes and theme tokens.
- **Tests & Verification:** Added `src/core/signals/__tests__/stateMachineRuntime.test.ts` and ran Milestone 2 full verification covering Batch 1 & Batch 2 (Phases 132–151).
