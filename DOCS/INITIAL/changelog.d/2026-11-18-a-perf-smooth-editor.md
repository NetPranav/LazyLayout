### Changed

Measured on a 4×-throttled CPU (a mid-range laptop) with 46 animated layers, before → after:

- **Opening Motion no longer freezes the editor.** The panel animation fired a window `resize` event on every frame, and every resize listener in the editor (toolbar, menus, popovers) re-read its layout. It now announces the new layout once, when the panels come to rest. Panel drags do the same when you let go.
- **Adding, duplicating and moving layers is lighter.** The page-wide base styles keyed off `html:has(.ll-editor-root)`, so adding any element made the browser restyle the whole editor (about 2,400 elements). They now key off a class on `<html>`. The canvas also stopped measuring every layer, and forcing a layout for the rulers, after each of its renders. It now does so only when the document, zoom, pan or page size changes.
- **Play starts at once after an edit.** Play used to re-sample every animated layer at every frame of the timeline after any edit (a freeze of about a second). Samples are now cached per layer and kept across visits to Motion, so only the layers you changed are re-sampled, and that's done ahead of time while the editor is idle. The animation kernel also stopped scanning every clip in the document for each layer at each frame.
- **Playback renders less.** During playback, each open timeline row re-rendered completely 10 times a second; now only its value readout and key toggle update.
- **Design loads first.** The Motion timeline, the Code panel and the 3D panels are split out of the editor's first download. They load in a queue while you work (Motion first), and pointing at a mode tab starts loading that mode at once.
- **Autosave** no longer upgrades the whole stored project on every save just to read its revision and dates.

### Added

- `tests/e2e/editor-perf-budget.spec.ts`: performance budgets checked by counting work, not timing it. It counts window resizes across a mode switch, page measurements per duplicate, layers re-sampled by Play after a one-layer edit, and `html:has()` rules on the page.
- `npm run perf:probe` and `npm run perf:profile` (playwright.perf.config.ts) to measure the editor and record CPU profiles; `scripts/analyze-cpuprofile.mjs` maps a profile back to source.
