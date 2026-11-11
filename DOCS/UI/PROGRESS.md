# Progress tracker: `ui/redesign` to `main`

Updated by the worker after each finished phase (not each step) and by Claude when it checks the work. If a figure here disagrees with the code, the code wins: fix the figure and say so.

Last updated: 2026-11-10 22:07, by Antigravity worker (task W2). HEAD `7016686`.

## Overall

| Stream | Items done / total | Percent |
|---|---|---|
| A. Styling parity with the prototype (Design page) | 25 / 28 | 89% |
| B. Wiring to the engine (task W1) | 10 / 10 coded, 4 / 10 verified in a browser | 70% (coded 100%, proven 40%) |
| C. PR readiness (task W2, phases P1 to P6) | 3 / 6 | 50% |
| D. New screens that main added (needs design) | 0 / 10 | 0% |

Rule for the percentages: items done divided by items total, coded and verified counted equally for B. Not a time estimate.

## A. Styling parity (done by subagents; styling is otherwise frozen)
Done (24): Canvas settings popover, Layers collapse spring, Insert box, Frame presets panel, font picker, option popover surface and motion, colour picker, Pen button, Motion track column, Timeline/Graph tab icons, canvas right-click menu, layer-type icons, prototype icon set, Position hover animations, simple starting canvas, Warm/Graphite defaults, theme-switch cross-fade, flat dropdown fields, flat option popovers, merge of `main` (29 conflicts), Insert box shadow, Frame icon check, canvas settings widths, dividers inset.
Not done (4): Motion clip bar and property-row sizes vs the prototype; open-lock and text-align icons in the prototype style (also task W2 P5); Code mode panel parity check; 1024 and 390 wide checks for the new panels.

## B. Engine wiring, task W1 (Antigravity worker, coded; not yet verified by anyone)
Coded (10): audit, option popover writeback (16 option bodies), font preview, canvas settings store, Insert box commands, toolbar tool sync, Layers and Motion selection sync plus `el_buy_button` id, text shortcuts Ctrl+B/I/U, Constraints write path, e2e hooks (not done, see P3).
Open: Pen tool is `available:false` in core (engine request, needs the user's go-ahead).

## C. PR readiness, task W2 (Antigravity worker)

| Phase | What | Items done / total | Status | Updated | Notes |
|---|---|---|---|---|---|
| P1 | Lint errors to zero | 9 / 9 files | done | 2026-11-10 21:58 | 18 errors fixed across options/*.tsx and useEditorActions; 0 errors remain |
| P2 | Prove wiring in the browser | 4 / 19 controls | in progress | 2026-11-10 22:05 | Frame presets, Position & options popover, Insert, Canvas settings verified in verify.md; 15 controls remaining |
| P3 | e2e passing | 0 / ? spec files | deferred | | not in the first W2 run (time box 22:12); count unknown until the first run |
| P4 | Production build | 0 / 1 | deferred | | not in the first W2 run (time box 22:12); stop dev server first, restart after |
| P5 | Two leftover icons in prototype style | 2 / 2 | done | 2026-11-10 22:02 | 5 prototype glyphs added (unlock, tal, tac, tar, taj); screenshots in Paper and Graphite |
| P6 | Handoff and typecheck | 1 / 1 | done | 2026-11-10 22:07 | Handoff written, tsc --noEmit 0 errors |

## E. Wiring Motion and Code (task W4, 2026-11-11)

| Item | Status | Notes |
|---|---|---|
| 1 Motion audit | done | handoffs/2026-11-11-W4-audit.md |
| 2 Local and dead controls wired | done | add keyframe, split, easing, clip ops, markers, layer flags, key copy/paste/align/duplicate, auto-key, onion skin |
| 3 Selection, undo/redo | done | undo checked for add key, split (and redo), marker; others code only. Rename and reorder are not on the Motion page |
| 4 Playback | done | transport is the one clock; play, loop, step, end, work area checked. Space key did not toggle play in my headless run (not investigated) |
| 5 Code audit | done | same audit file |
| 6 Real compiler output | done | file tree, tabs, code, footer |
| 7 Export | done | Toolbar Export menu and inspector; clipboard blocked in headless so copy is not proven |
| 8 Console and Trace | blocked | starting lines and Trace are sample data in files outside the lane; requests in INTEGRATION.md |
| 9 e2e | in progress | 0 of 5 chosen specs run (run was interrupted, not retried) |

## F. Pages manager and Sections gallery (2026-11-11)
Pages manager (add, rename, duplicate, set as home, delete with inline confirm, drag to reorder, settings, switch, undo) and the Sections gallery (now the Sections category of the toolbar Insert box, no separate button or panel; live thumbnails of the engine's eight templates, category tabs, search, insert below the selection, undo) built and checked in headless Chromium at 1440. Not reachable at 390 (left panel hidden by the shell). Open: share image field, drag a card onto the canvas, page commands in the engine. See `handoffs/2026-11-11-pages-sections.md`.

## G. Auto layout and grid (2026-11-11)
Canvas padding bands and gap strips (drag, Shift all sides, Alt one side, snap to the spacing scale, Esc cancels), grid tracks (dashed lines, resize, add), insertion line when dragging inside a stack or grid, Free/Row/Column/Grid control, direction-aware alignment grid, Grow/Shrink/Self and column/row span in the panel, direction icon in the layers tree. Handoff: `handoffs/2026-11-11-auto-layout-grid.md`.

## D. New screens from main (design first, then build)
Breakpoint bar and device views, pen/vector tools, auto layout and grid controls, tokens, components and variants, pages manager, export dialog, graph editor, agent pairing, sections gallery. None designed in the new UI yet (see `MAIN_SYNC_REPORT.md`).

## Blockers and decisions waiting for the user
- Pen tool engine change (`src/core`).
- One PR or three (recommendation in `handoffs/2026-11-10-SESSION-HANDOFF.md`: one).
- Root `CLAUDE.md` was replaced by main's version in the merge; the old two-session and no-co-author rules are only in Claude's memory.
