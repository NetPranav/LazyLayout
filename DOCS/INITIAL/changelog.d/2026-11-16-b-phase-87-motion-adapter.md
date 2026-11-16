### Phase 87 (Motion engine adapter): the stage's transitions run on Motion, layout changes travel, layers enter and leave

Motion is loaded lazily and its spring and keyframes generators move every state, variant and layout transition on the stage, stepped by the editor's own frame clock. A layer can animate its layout changes and have a way to appear and to disappear. The phase stays in progress because Phase 86 is.

#### Added
- `loadMotion`, `MotionMover`, `stageMover` (the file `MotionAdapter.ts` in `src/core/engine/motion`).
- `motionPropsOf`, `motionTransition`, `motionKey` (the file `motionConfig.ts`): a layer's states and transition as Motion props.
- `LayoutDriver` (in `src/core/engine/stage`), `layoutJump`, `presencePose`.
- Layer properties `layoutMotion.on`, `presence.enter`, `presence.exit`. Command `layer.setLayoutMotion`.
- **Layout**, **Appears** and **Leaves** in the Transition section, which now shows on every layer.
- 12 unit tests and two browser tests.

#### Changed (shared hot spots)
- `src/core/states/transitions.ts`: `MoverLike`, `MoverFactory`, `kernelMover`, and `Mover.shift`.
- `src/core/engine/stage/StageEngine.ts`: a new option `layout`; the layout driver runs after the adapters have drawn. `StateDriver` and `VariantDriver` hosts take an optional `mover`.
- `src/core/document/properties.ts`: three new paths. One new command. No schema version change.

#### Not done
- Size changes are not animated, only the place.
- `whileInView` and `whileDrag` have no trigger on the stage yet.
- Layout motion and presence in the exported code.
