# Task F2: timeline playhead, behaviour and design must match the prototype

Read `DOCS/UI/tasks/2026-11-08-COMMON.md` first. Given by the user's feedback (2026-11-08): "fix the playhead in the timeline and also see the timeline behaviour and design in the design html file".

## Read
P (`DOCS/UI/design/editor-design-mode-blocks-dark.html`): the Motion timeline CSS (lines ~898-1211, "Motion pass 3": header, ruler, tracks, clips, keyframes, playhead `.ph*`/`#playhead`, footer, work area) and the timeline JS in the main script (grep `playhead`, `scrub`, `ruler`, `workArea`, `keyframe`, `marquee`, `pps`, `clipDrag`, `trim`). CHANGELOG row "Motion timeline" (2026-11-04). App: `src/editor/panels/timeline/**`, `src/editor/motion-model/**`, testids in `DOCS/UI/handoffs/e2e-testids.md` (`timeline-ruler`, `timeline-playhead`, `timeline-playhead-layer`, ...).

## Do
1. **Playhead:** open the app in Motion mode (http://localhost:3000/editor, click the Motion tab) and P side by side in headless Playwright. Find what is wrong with the playhead (position vs time, needle and head shape/size/colour, line spanning ruler plus all tracks and the work area, offset from the track column, drag/scrub from ruler and head, snapping to frames/keyframes/markers, follows playback, stays in sync after zoom (Ctrl+wheel) and scroll, timecode readout, goes behind/over clips as in P, clipping at the track column edge). Fix every difference so it behaves and looks exactly like P.
2. **Timeline behaviour and design:** compare the whole timeline with P in the same state and fix differences: header 40px layout and transport, ruler ticks and labels, track column 264px resize, layer rows and property rows, clips (move, trim, split), keyframes (add, select, marquee, drag, duplicate, delete), work area handles, markers, zoom, footer 28px with mini-map, focus dimming of other layers (45%), shortcuts (K, Space, arrows, Ctrl+D, Delete). Keep every timeline testid and `[aria-label="Motion Timeline"]`.
3. Motion through the shared springs, reduced motion, tokens only, no raw requestAnimationFrame (use the motion loop).
Lane paths: `src/editor/panels/timeline/**`, `src/editor/motion-model/**`, `src/editor/design-system/demos/B7Demos.tsx`, tokens inside lane block `B7 motion`.
Done: before/after screenshots (app vs P, same state, Warm and Darkroom, 1440 and 1024) in `DOCS/UI/handoffs/screenshots/f2/`, a short written list of every difference found and fixed, tsc own files, one handoff `2026-11-08-HHMM-F2.md`. Do not commit.
