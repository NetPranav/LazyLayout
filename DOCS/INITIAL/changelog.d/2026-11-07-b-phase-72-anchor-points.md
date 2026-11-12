### Phase 72 (Anchor points & pins): rotation and scale about a point you choose

#### Added
- **One pin model** (`src/core/geometry/pins.ts`): the 9 presets (top left, top, top right, left, center, right, bottom left, bottom, bottom right), plus custom pins in px or % that may lie outside the layer's box. The anchor is the pin rotation and scale turn about.
- **The transform maths** (`transforms.ts`): `P_world = F + A + R·S·(P − A) + T`. A layer's anchor stays put whatever its rotation and scale; rotate then scale is not the same as scale then rotate; zero scale doesn't divide by zero. Moving the anchor compensates the translation, so the layer doesn't jump.
- **On the canvas:** hold **Ctrl** (Cmd on a Mac) over a selected layer to grab its anchor handle (a bullseye); drag it and it snaps to the 9 presets, showing the targets while you drag. A layer whose anchor is the centre shows no mark. One undo step per drag.
- **In the inspector:** Position → **More Position options** → **Transform origin** offers the 9 presets and custom origins.
- Tests: `pins.test.ts`, `anchorTransforms.test.ts` (golden matrices for 90° rotation, scale [2, 0.5], and 45° with [1.5, 0.8], at every preset pin), `AnchorOverlay.test.tsx` and `tests/e2e/anchor-points.spec.ts` (drag the anchor to a corner; change the origin in the inspector).
