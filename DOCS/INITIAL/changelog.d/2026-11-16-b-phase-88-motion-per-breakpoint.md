### Phase 88 (Motion per breakpoint): a layer's animation can be calmer, slower or off at a smaller size

Four settings on a layer say whether its animation plays, how slow and how far. Like any property they can be overridden at a breakpoint. The phase stays in progress because Phase 87 is.

#### Added
- `motionAtOf`, `layerAtBreakpoint`, `scaleDistance` (the file `breakpointMotion.ts` in `src/core/breakpoints`).
- Layer properties `motion.plays`, `motion.timeScale`, `motion.distance`, `motion.loops`. Command `layer.setMotionAt`.
- A **Motion at this size** section in the Motion inspector.
- 8 unit tests and one browser test.

#### Changed (shared hot spots)
- `src/core/kernel/evaluate.ts`: a new input `breakpoint`. With it set, a layer's base values are the ones that breakpoint sees. Without it nothing changes.
- `src/core/engine/stage`: `setBreakpoint` on the kernel, Web Animations and stage adapters; `installStageEngine` takes `breakpoint`.
- `src/core/document/properties.ts`: four new paths. One new command. No schema version change.

#### Not done
- One clip of several switched off by itself; a loop's own numbers per breakpoint.
- Device-view mirrors are not animated, so sizes can't be compared side by side while playing.
- Per-breakpoint motion in the exported code.
