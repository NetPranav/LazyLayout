# Task: Shell layout and transitions (`L8`), Wave 2

- **Given by:** Claude (build session), 2026-11-05, from `DOCS/UI/PARALLEL_BUILD.md` Wave 2. Runs in parallel with L9. Wave 1 lanes (L1 to L7) are done and committed before you start.
- **Read first:** `.claude/agents/ui-worker.md` (rules and known mistakes), then the prototype `DOCS/UI/design/editor-design-mode-blocks-dark.html` (P) lines below. Never read P whole (7137 lines).
- **Lane paths (only these):** `src/editor/shell/EditorShell.tsx`, `src/editor/shell/*.tsx` and `src/editor/shell/*.ts` at the top level of `shell/` (not the sub-folders), `src/editor/styles/**`.

## What to build (from P)

Read: CSS `46-47` and `442-456` (bottom block, heights), `4900-4958` (**shared spring panel transition**: `--lw`, `--rw`, `--bh`, `--fw` are spring-driven; `--fw` 0 normal, 1 full-width timeline), `4959-5068` (mode switches morph: the layout stays, panel springs move, old content slides out one way with a small blur, the new slides in; mode tab highlight; mode menus are L1's), `5069-5200` (timeline intro, focus dimming), `4146` and `6313-6337` (views of the bottom panel).

1. **Full-width bottom panel:** the bottom panel spans the full window width by default in Motion and Code (`--fw`), `Shift+T` toggles it. Timeline height splitter: height 40% of the window by default, drag to resize, double click glides back to 40% (the splitter itself and its drag logic are L5's inside `panels/timeline`; you own the layout variables and the shell grid: expose `--bh` and the full-width flag to it and say in the handoff what L5 exposes).
2. **Header band and panel shadow** as P (`.bottom` header band, soft shadow on the bottom panel).
3. **`panelFx` springs** for panel collapse and expand (left, right, bottom): the shared spring panel transition above, on the shared motion engine (`src/editor/motion/*`, read-only), no raw `requestAnimationFrame`, reduced motion = 120ms fade.
4. **Mode-switch transitions** as in P (`4959-5068`): tab highlight, panel content sliding in tab order with content blur, inspector cascade, Design to Motion rise, Motion to Code fold, Code to Design sink. Under 400ms, interruptible (a second click mid-transition retargets).
5. **Cross-panel focus dimming:** canvas at 60% while the bottom panel has focus (P `5147`).
6. Keep every prop and callback that `EditorShell` passes to the lane components (`TopBar`, `LeftPanelConnected`, `CanvasChrome`, `RightPanelConnected`, `TimelinePanel`, `CodePanel`): the Wave 1 lanes changed their insides, not their signatures. Mount the Wave 1 results: the new Motion inspector (`MotionInspector` from `panels/inspectors`, see the L6 handoff `DOCS/UI/handoffs/*L6*.md`) in Motion mode of `RightPanelConnected`, and the new Code right panel from `panels/code-view` in Code mode (see the L7 handoff). `RightPanelConnected.tsx` is in `shell/` top level: it is yours. Keep project boot, autosave, lock and persistence banners working.

## Done

Same as every lane: measured comparison with P at 1440 (Paper and Dark; Design, Motion, Code), `npx tsc --noEmit` once, screenshots in `DOCS/UI/handoffs/screenshots/L8/`, handoff `DOCS/UI/handoffs/2026-11-05-HHMM-L8.md` with the real tsc output and what you did not verify. No commits, no pushes, no `git add/checkout/stash/reset`, never run `eslint --fix`, prettier or any command that rewrites many files. The dev server is running on http://localhost:3000 (do not start `next dev` or `next build`). Run every check in the foreground and never wait on background tasks.
