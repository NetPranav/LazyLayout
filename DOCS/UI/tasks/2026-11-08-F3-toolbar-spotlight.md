# Task F3: toolbar placement and the toolbar to command-centre (Spotlight) transition

Read `DOCS/UI/tasks/2026-11-08-COMMON.md` first. Given by the user's feedback (2026-11-08): "the place of the toolbar and the transition between toolbar and command centre" are not right yet.

## Read
P (`DOCS/UI/design/editor-design-mode-blocks-dark.html`): `#tools` markup and CSS (`.ftool`, `.tbghost`, `.tbpop`, lines ~800-830), `<script id="ll-tbar">` 10521-10888 (per-mode toolbars, morph between modes, narrow-canvas lift above the zoom bar), `<script id="ll-spot">` 10023-10398 and CSS `.sp-*` (lines 609-637): how the toolbar morphs into the 560px Spotlight field and back, where the results stack, the timings/springs. App: `src/editor/shell/canvas-chrome/**` (Toolbar.tsx, Spotlight.tsx, spotlight.css, CanvasChrome.tsx, constants).

## Do
In headless Playwright (Warm and Darkroom, 1440/1024/390) compare app vs P in the same states and fix every difference:
1. **Toolbar place:** exact position on the canvas (bottom centre, offset from the zoom bar and bottom panel in Design, Motion with the timeline open, Code with the code panel open), what it does when side panels open/close or are resized (stays centred on the visible canvas), lift above the zoom bar when the canvas is narrow, z-order, size, gaps, radius, shadow. In Motion and Code mode it must sit above the bottom panel exactly as in P.
2. **Transition toolbar <-> Spotlight:** Ctrl+K or `/` on the canvas: the toolbar itself grows into the 560px field (same element morphs: width, radius, content crossfade with blur on the Bouncy spring from the shared motion table), results panel grows upward out of it, items stagger in; Esc/outside click reverses it and the toolbar tools return. Closing mid-open must be interruptible. Reduced motion: opacity fade only. No jump, no flicker, no double toolbar.
3. Mode switch morph of the toolbar (Design/Motion/Code) must match P too.
Keep all existing ids and testids (`#tools`, `canvas-chrome`...). Tokens only, no raw requestAnimationFrame (motion loop), shared springs.
Lane paths: `src/editor/shell/canvas-chrome/**`, `src/editor/design-system/demos/B5Demos.tsx`, tokens inside lane block `B5 chrome`.
Done: before/after screenshots (app vs P, same state), plus a frame-by-frame strip (6 frames) of the open and close transition for app and P, in `DOCS/UI/handoffs/screenshots/f3/`; tsc own files; one handoff `2026-11-08-HHMM-F3.md`. Do not commit.
