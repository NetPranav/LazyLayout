### Phase 119 (Variable-width strokes): taper, swell and calligraphic strokes, saved profiles, width handles on the canvas

#### Added
- A **Swell** width preset, and **calligraphic** profiles: the width a flat nib at an angle draws along the layer's own path (`core/paths/widthProfiles.ts`, command `stroke.calligraphic`).
- **Saved width profiles** in the document (`widthProfiles`, optional, no migration): commands `stroke.saveWidthProfile`, `stroke.applyWidthProfile`, `stroke.renameWidthProfile` and `stroke.removeWidthProfile`.
- In the stroke popover, a **Profile** group: preset or saved profile, Nib angle with Apply, "On canvas", Save profile.
- **Width handles on the canvas** (`editor/stage/WidthOverlay.tsx`):
  - a pair per width point;
  - drag to widen and slide (Alt: one side);
  - click the path to add a point, double-click to remove one;
  - one undo step per drag.
- `widthProfiles.test.ts` (6 tests) and `tests/e2e/variable-width.spec.ts`.

#### Not done
- Handles follow a layer's first subpath only, and ignore its rotation. A calligraphic profile is worked out once and does not follow later path edits. Firefox and WebKit were not run.
