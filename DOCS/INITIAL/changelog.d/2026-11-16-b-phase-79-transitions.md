### Phase 79 (Transitions): a layer moves between its states on a spring or a tween, and interruptions never snap

A layer with states (Hover, Pressed, ...) now moves into and out of them on a transition set on the layer. A spring keeps its speed when the target changes mid-way, so quick hovers and clicks stay smooth. The phase stays in progress because Phase 78 (Lane A's) is not marked done.

#### Added
- `Mover`, `transitionOf`, `transitionOverrides` (the file `transitions.ts` in `src/core/states`). No DOM.
- Layer properties `transition.type`, `transition.duration`, `transition.bounce`, `transition.curve`, and three slots `transition.N.property`, `.type`, `.duration`, `.bounce`.
- Commands `layer.setTransition` and `layer.setTransitionOverride`.
- A **Transition** section under **States** in the Design inspector.
- 13 unit tests and two browser tests.

#### Changed (shared hot spots)
- `src/core/document/properties.ts`: 16 new paths (`transition.*`). No schema version change.
- `src/core/kernel/evaluate.ts`: a new input `stateMix`; a layer with an entry there is drawn from it instead of `activeStates` and `stateBlend`, which still work.
- `src/core/engine/stage/StateDriver.ts`: states move on the layer's transition, several at once. The frame it returns keeps `activeStates` and `stateBlend` and adds `stateMix`.

#### Not done
- Transitions in the exported code.
- A different transition for each pair of states.
