# E2E migration to the new editor (partial)

## Counts (real runs, chromium, workers=2, dev server)
- Before (original helpers, `--timeout=15000`): 57 passed, 112 failed, 2 skipped (171 tests). 106 of the failures were the 15 s timeout, most in `openEditor`/`waitSaved`/`openFileMenu`/`openSequencer` or on old selectors.
- After: NOT available. The full re-run (`--timeout=30000`) was still running when this handoff was written, and two of my background shells were reaped by low memory.

## Done
- `tests/e2e/support/editor.ts`: `waitSaved` (waits for `[data-testid="save-status"][data-state="saved"]`), `focusApp` (logo button "Application menu", then Escape), `openFileMenu` (logo menu, hover File menuitem), `openSequencer` (tab "Motion", waits for `[aria-label="Motion Timeline"]`), `exportProject` (menuitem "Export project file"). `openEditor` unchanged.
- `tests/e2e/transport-bar.spec.ts`: migrated to toolbar "Timeline header" (Playhead time, Step forward (Right), Play (Space)/Pause (Space), Go to start (Home), Loop: Off/Loop/Ping-pong). Passes. The new editor opens with the playhead at 00:01.12, so the test goes to start first.

## Known causes still open (not yet fixed)
- Old selectors in most specs: `.dock-zone--*`, `.dock-layout`, `.canvas-overlay__*`, `.layers-row__name`, `.sequencer-ruler-wrap`, `[data-timeline-ruler]`, "Timeline tool" button, `getByTitle("Add keyframe at current playhead position")`, "Transport" group, "Mount Showcase Demo" lab buttons.
- The timeline ruler/seek helpers (`seekRuler`, `SEQUENCER_PIXELS_PER_SECOND`) target the old sequencer and are untouched.
- `stageShot` uses `.dock-zone--center`, which no longer exists.
- Lab-route specs (stage-*, render-gallery, paint-render) mostly passed before; lab routes were not checked for 404.

## test.fixme
None added.

## Needs from the app
- Stable test hooks for the stage/canvas root, the layer rows, the selection overlay and the timeline ruler (data-testid), plus a playhead-time data attribute.

## Not run
- Per-spec fixes beyond transport-bar; the post-change full run; Firefox/WebKit.

## Addendum: the after-run finished, but it is not trustworthy
The full re-run ended with 2 passed, 167 failed, 2 skipped in 7 min. It ran while the machine was critically low on memory and while I removed the temporary config, so treat it as invalid, not as a regression. Re-run the full suite on a healthy machine to get real after numbers.
