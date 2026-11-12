### Phase 76 (Property links & pick-whip): link one layer's rotation to another's position

#### Added
- **Property links.** A layer's property can follow a property of another layer, or of itself: the hero's rotation follows the null's x. Up to eight links per layer, stored on the layer, so they save, undo and keyframe like any other setting. No schema change.
- **Three maps:** **direct** (the number passes through), **range** (an input range onto an output range, clamped or not, either end reversible) and **curve** (the position in the range goes through an easing first).
- **Chains and order:** a link can read a property that is itself linked, and a layer can drive one of its own properties from another of its own. A link wins over the target's own animation. A property that a link drives is drawn by the animation engine every frame, and a linked position reaches the stage.
- **Cycles are refused** with `[LINK_CYCLE]` and the chain that closes them, before anything is written: `[LINK_CYCLE] Null.transform.x ← Hero.transform.rotate ← Null.transform.x`. A cycle that is already in a file stops where it closes instead of looping.
- Commands: `layer.setLink` (the pick-whip; defaults the map to the source's range onto the target's when both have one) and `layer.removeLink`.
- Tests: 23 unit tests (golden values for every map, an animated source at five times, chains, self-driving, cycles, the commands) and `tests/e2e/links.spec.ts` (a hero follows a sliding null in the real stage at five times). The scene is in the stage lab ("Load link scene").

#### Not done
- The pick-whip drag in the timeline and inspector, and a list of a layer's links (the commands and the cycle message are ready; the UI pipeline wires them). Links to colours or text. Links in exported code. Firefox and WebKit runs (CI).
