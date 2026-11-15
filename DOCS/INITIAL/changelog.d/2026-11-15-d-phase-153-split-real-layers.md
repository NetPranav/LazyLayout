# Stage 4 · Phase 153 · Split into real layers

- **Scope:** Implemented Phase 153 in Lane D (`d/phase-153-split-real-layers`) stacked on `d/phase-152-helpers-pins-follow`.
- **Core (`src/core/signals/splitIntoLayers.ts`):**
  - Added `splitTextIntoRealLayers` (`letters` / `words` / `lines`) building real, rule-addressable child layers aligned to unsplit glyph coordinates within `< 0.5 px`.
  - Enforced single-pass screen-reader reading (`aria-label` on parent, `aria-hidden="true"` on child copies) plus `[data-text-stroke-copy]` selector metadata for stroked text (Lane C parity).
  - Added non-destructive `setSplitPieceOverrides` / `reconcileSplitTextLayers` override preservation across edits and `detachSplitLayers` to convert pieces to standalone layers.
- **Tests:** Added `src/core/signals/__tests__/splitIntoLayers.test.ts` (5 fixture strings + non-destructive override retention + detach + AT assertions; verified at Milestone 3).
