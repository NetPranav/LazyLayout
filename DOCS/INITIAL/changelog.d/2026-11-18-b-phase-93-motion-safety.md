### Phase 93 (Reduced motion and accessibility rules), second half: a Motion safety list with a fix for each problem

Flashing, a loop nobody can pause, a tap target under 44 px and nothing showing on focus are listed for the selected layer and for the whole page. The phase stays in progress: Phases 82 and 84 are not done, and the exported page does not draw a pause control yet.

#### Added
- `src/core/rules/motionSafety.ts`: `motionSafety`, `safetySummary`. It reuses the existing flash detector (`rules/accessibility.ts`) and the Playground's tap-target maths; the loop rule and the focus rule are new.
- Properties `motion.essential` and `motion.pausable`. Commands `layer.setMotionSafety`, `motionSafety.growToTouchTarget`, `motionSafety.slowFlashing`.
- A **Motion safety** section in the Motion inspector.
- 13 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/document/properties.ts`: two new paths. No schema version change.

#### Not done
- A pause control in the exported page (Phase 95); editing the reduced-motion variant per effect.
