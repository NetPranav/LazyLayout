### Phase 70 (Auto-key on the stage & value HUD): animate by dragging things around the canvas

#### Added
- **Auto-key record mode** (the record dot in the timeline's transport row, "Auto-key record mode"). While it is on, dragging a layer on the canvas writes position keyframes at the playhead, in the same undo step; a drag at 3 playhead times makes 3 keyframes. Auto-key is part of the document's commit step (`applyAutoKey`), so every way of editing records, not only drags.
- **Value HUD:** while you drag or scrub, the layer's x, y, rotation and opacity show next to it.
- The motion playhead and the transport clock are one (`motionActions.setPlayhead` seeks the transport).
- Tests: `AutoKeyValueHud.test.ts` (3 drags make 3 keyframes, playback matches `evaluate()`, undo removes them, the HUD formats live values; keyframes land in the clip's own time through the layer's bar and the clip's offset) and `tests/e2e/auto-key-hud.spec.ts` (3 tests: the toggle, the live HUD on a drag, a 3-time recording journey, and a fourth drag with record off that adds nothing).
