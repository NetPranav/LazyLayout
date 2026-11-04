# Task: Design system page (`L9`), Wave 2

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md` Wave 2. Runs in parallel with L8. Wave 1 lanes are done before you start.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes), `DOCS/UI/UI_RULES.md` section 3.
- **Lane paths (only these):** `src/editor/design-system/**`, `src/app/design-system/**`.

## What to do

1. **Wire every lane's demo file into `/design-system`:** `src/editor/design-system/demos/TopBarDemos.tsx`, `LeftPanelDemos.tsx`, `InspectorDemos.tsx`, `CanvasDemos2.tsx`, `TimelineDemos.tsx`, `MotionInspectorDemos.tsx`, `CodeModeDemos.tsx` (some may be missing or partial: wire what exists and list what is missing). Add sidebar entries in the right groups (Shell, Canvas, Panels, Motion), search and anchors keep working, the scroll resets on section change (already built: keep).
2. **All states** for each demo: default, hover, focus, active, disabled, loading and error where they apply, with a working control panel like the existing demos.
3. Add `MenuHeading` and `ThemeSwatch` to the page as demos if they exist in `components/` (they were added in Wave 0; if not, create them in `components/` with a demo: you may edit `components/index.ts` for that).
4. **Foundations:** Colors shows **all eight themes** (Paper, White, Warm, Lilac, Noir, Dark, Graphite, Darkroom) and the six label colours; Layout Sizes lists the sizes the shell uses (toolbar 443x50 and 40px buttons, zoom bar 186x50, top bar 52, panels, bottom panels, row heights, track column 264, timeline header 40, footer 28); Motion section shows the springs and the three feels.
5. **Promote shared controls** that lanes built locally: the slider built by L6 (`panels/inspectors/Slider.tsx`) goes to `components/Slider.tsx` with a demo (move it, keep the old import path working by re-export, update L6's imports in `panels/inspectors` only for that one import).
6. Every demo uses sample props, never a store. Route stays guarded by the shared `labsEnabled`.

## Done

Screenshots at 1440 of every new section in `DOCS/UI/handoffs/screenshots/L9/`, `npx tsc --noEmit` once (real output in the handoff), handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L9.md` with the list of sections wired and the list of demos missing. No commits or pushes, no `git add/checkout/stash/reset`, never run `eslint --fix`, prettier or any command that rewrites many files. The dev server is running on http://localhost:3000 (do not start `next dev` or `next build`). Run every check in the foreground and never wait on background tasks.
