### Phase 93 (Reduced motion, first half): every layer has a reduced-motion policy, and the canvas can show it

Under reduced motion a layer's fades still play but its movement and loops don't (or it plays in full, or not at all, as the layer says). The canvas has a switch to preview it. The phase stays in progress: only this half is built.

#### Added
- Layer property `motion.reduced` (`auto`, `full`, `off`); `reduceMotion`, `reducedPolicyOf` in `breakpointMotion.ts`.
- `useMotionPreferenceStore`, `reducedMotionNow`; command `view.reducedMotion`.
- **Reduced** and **Show it** rows in **Motion at this size**.
- 5 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/kernel/evaluate.ts`: `reducedMotion` input now applies the policy. `src/core/engine/stage`: `setReducedMotion` on the adapters, `reducedMotion` option on `installStageEngine`. The state, variant and layout drivers read the same answer.
- `src/core/document/properties.ts`: one new path. No schema version change.

#### Not done
- Flash limits, pause controls, visible focus and touch targets; the library's variants; the Playground toggle.
