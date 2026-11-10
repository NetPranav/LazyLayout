# Task W4: Wire the Motion and Code pages to the engine and backend (styling is frozen)

Date: 2026-11-11. Branch `ui/redesign`. Do not commit, do not push. Do not stop to ask. Read first (only these): `DOCS/UI/INTEGRATION.md` (§2 contracts, §3 engine requests), `DOCS/UI/MAIN_SYNC_REPORT.md`, `DOCS/UI/handoffs/2026-11-10-W1-audit.md`, and W3's handoff `DOCS/UI/handoffs/2026-11-10-HHMM-W3.md` if it exists. Old working behaviour to copy (read only): `src/legacy-editor/**` at `/editor/legacy`.

## Goal
Every control on the **Motion** (timeline) and **Code** pages must read from and write to the real engine/stores, and the Code page must show and export the real generated code. **No restyling**: keep classes, tokens, icons, layout and animation exactly as they are.

## Lane (you may edit)
`src/editor/panels/timeline/**`, `src/editor/motion-model/**`, `src/editor/panels/code-view/**`, `src/editor/shell/left-panel/FilesTree.tsx` and the Code-mode data hooks in `src/editor/shell/left-panel/**`, `src/editor/shell/canvas-chrome/Toolbar.tsx` (Motion and Code tool groups only), `tests/e2e/**` (selectors, hooks, seed expectations only), `DOCS/UI/**`. Do not touch `EditorShell.tsx`, `CanvasChrome.tsx`, `useEditorActions.ts`, `panels/details/**` (W3's); if a change there is unavoidable, list it under "Needs in shared files" in your handoff instead.
**Off limits:** `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`. Engine needs go under "Engine changes requested" in `INTEGRATION.md` (what, which file/command, which control). No `eslint --fix`, prettier or mass rewriters; keep LF/CRLF endings.

## Work, in order (after each item, check it in the running app; update `DOCS/UI/PROGRESS.md` once per finished item)
### Motion
1. **Audit** to `DOCS/UI/handoffs/2026-11-11-W4-audit.md`: every control on the Motion page (transport, timeline/graph switch, layer rows, property rows, keyframes, markers, work area, toolbar Motion group: keyframe, split, easing, marker, work in/out, duplicate keys; footer, speed, loop, onion skin, snap, auto-key, export) marked wired / local only / dead.
2. Connect every "local only" or "dead" control to the real motion model and engine (clock, frame scheduler, keyframe commands in `src/core`). Add keyframe at playhead (`timelineOpsAdapter.addKeyframeAtPlayhead` is a stub): connect if a core command exists, else request it.
3. Selection stays in sync between Layers, canvas, inspector and timeline; rename, visibility, lock and reorder written to the document; keyframe drag, easing change, split, duplicate, delete go through commands with undo/redo.
4. Playback: play/pause, scrub, loop, speed, work area drive the real stage animation; the playhead time and the document's animation clock agree.
### Code
5. **Audit** the Code page: file tree, tabs, code view, Console, Trace, header buttons (copy, download, wrap, find, format, view switch), toolbar Run and Export, inspector, status bar.
6. The code shown must come from the real compiler output for the current document and update live when the document changes (use `src/compiler` through its public API, read only). File tree lists the real generated files; selecting a file opens it.
7. **Export**: the toolbar Export menu is dead (`onExportOption` is never passed from `CanvasChrome`): wire "Repo .zip", "Current file" and "Copy npm install" using the existing export code in the engine or the logic in `CodePanel`; if wiring needs `CanvasChrome.tsx`, list it under "Needs in shared files". Copy, download and wrap must really work on the real file.
8. Console and Trace show real run output where the runtime provides it; where only sample data exists, mark it clearly in the audit and list the engine request.
9. **e2e**: run the specs that touch Motion and Code once (`npx playwright test <spec> --project=chromium`), fix selector and hook problems in `tests/e2e/**`; do not change product behaviour to satisfy a test.

## Done when
Each item is `done` or `blocked` with the exact reason in `PROGRESS.md`; `npx tsc --noEmit` 0 errors and `npx eslint src/editor` 0 errors (run once at the end); screenshots of anything you changed under `DOCS/UI/handoffs/screenshots/w4/` (headless Playwright, one browser at a time, close it); handoff `DOCS/UI/handoffs/2026-11-11-HHMM-W4.md` from `DOCS/UI/handoffs/TEMPLATE.md`, including "Needs in shared files" and "Engine changes requested". Unfinished means `in progress` with the exact count, never `done`. No handoff, no pass.
