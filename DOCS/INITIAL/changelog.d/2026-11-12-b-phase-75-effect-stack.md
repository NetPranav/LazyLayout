### Phase 75 (Effect stack & motion blur): stack effects on a layer and keyframe their settings

#### Added
- **An effect stack:** up to eight effects per layer, in order: **blur**, **glow**, **drop shadow**, **colour adjust** (brightness, contrast, saturation, hue), **displacement** and **noise**. Every parameter is a keyframeable property (`fx.N.*`), and the list order is the slot order.
- **How they are drawn:** blur, glow, drop shadow and colour adjust are CSS `filter` functions (cheap, off the main thread). Displacement and noise are SVG filters, which the animation engine keeps in the frame and updates in place as a parameter animates. The stage and the export share one function for the CSS part, and the engine draws the whole stack, so an animated effect is drawn by the same code as a still one.
- **The rules explain each route** (`src/core/rules/effectRouting.ts`): for every effect, which backend draws it and why, in plain words. A test checks the table against what is really drawn.
- **Motion blur**, opt-in per layer (the timeline's switch) with a **shutter angle** (180 by default). The kernel measures how fast the layer is moving and blurs it along the motion (an SVG Gaussian blur with a different amount across and down). Scrubbing shows the same blur as playing.
- Commands: `layer.addEffect`, `layer.setEffect`, `layer.removeEffect`, `layer.moveEffect`, `layer.setMotionBlur` (one undo step each; a ninth effect is refused).
- Tests: 24 unit tests and `tests/e2e/effects.spec.ts` (a 4-effect stack at five times equals the kernel's parameters in the real stage, the layer goes grey as saturation reaches 0, motion blur's amount equals the kernel's and smears a moving layer's edge). The scenes are in the stage lab ("Load effect scenes").

#### Not done
- The inspector's Effects section and the timeline stopwatches for effect parameters (the commands and property paths are ready; the UI pipeline wires them). Effects in exported code beyond the CSS ones. Displacement uses noise as its map (no image yet). The shader backend (Stage 4). Firefox and WebKit runs (CI).
