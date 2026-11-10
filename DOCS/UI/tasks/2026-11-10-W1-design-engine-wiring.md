# Task W1: Wire the Design page to the engine (styling is frozen)

Date: 2026-11-10. Branch `ui/redesign` (main merged at `d448f98`). Do not commit, do not push. Do not stop to ask.

## Goal
Every control on the Design page (`/editor`, Design mode) that looks finished but is not connected must read from and write to the real engine/store, so the app works end to end and a PR to `main` merges cleanly. **Do not restyle anything.** The visual design matches the HTML prototype and is frozen: no changes to classes, tokens, layout, icons or animation unless a wiring fix strictly needs it (then keep the look identical).

## Read first (only these)
- `DOCS/UI/INTEGRATION.md` §2 (engine contracts) and §3 (engine changes requested), §6 "Editor shell wired to the engine".
- `DOCS/UI/MAIN_SYNC_REPORT.md` (what main's engine already provides: motion clock/frame scheduler, stage overlays, new inspector props/hooks).
- `src/editor/shell/{EditorShell,RightPanelConnected,useEditorActions,prototypeDocument}.ts(x)`, `src/editor/stage/Stage.tsx`.
- The old working versions for behaviour reference (read only): `src/legacy-editor/**`, served at `/editor/legacy`.

## Lane (you may edit)
`src/editor/**` (logic, hooks, props, handlers, store hookups), `src/app/**`, `DOCS/UI/INTEGRATION.md`, `DOCS/UI/handoffs/**`, `tests/e2e/**` selectors only.
**Off limits:** `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`. If a control needs an engine change, add it under "Engine changes requested" in `INTEGRATION.md` (what is needed, which file/command, which control), leave the control as is, and carry on. No `eslint --fix`, prettier, or any command that rewrites many files. Keep LF/CRLF line endings of every file as they are.

## Work, in this order (one item at a time; after each, check it in the running app)
1. **Audit** (write it to `DOCS/UI/handoffs/2026-11-10-W1-audit.md`): list every interactive control on the Design page (top bar, left panel, toolbar, Insert box, Frame panel, View/Canvas settings popover, right-panel inspector sections and their option popovers, context menus, text format bar) and mark each: wired to engine / local state only / dead. Use headless Playwright (one browser) and the code. Keep the table short (one row per control group).
2. **Option popovers have no writeback.** The option bodies in `src/editor/panels/details/options/*.tsx` (Position, Layout, Appearance, Typography, Fill, Stroke, Effects, States, Image, Divider, Background, Icon, Shape, Counter, 3D, Theme tokens) keep values in local state, so they reset on reopen and change nothing. Connect each field to the selected layer's properties through the same path the main inspector sections use (`useSelectionInspector`, `readFor`, `localFor`, the commands in `src/core`). The popover must keep its open state and must not remount on writes (it closes only on a canvas click: keep that behaviour).
3. **Font picker** (`FontPicker.tsx` in Typography): picking a family must write `fontFamily` to the selected text layer(s); hover preview via the existing `onPreview` prop (pass it from `TypographySection`); verify on a real text layer.
4. **Canvas settings popover** (`ViewOptionsPopover.tsx`): every toggle/slider/segment (grid type/size, pixel grid, checkerboard, rulers, snapping toggles + threshold, pan/zoom options, axes, inspect, dragging, reparenting, collision, marquee, theme, motion feel, list edge blur) reads and writes the real store/prefs. The Snap guides / Snap to grid values currently come from the legacy snap store with the wrong defaults: wire them to the real snapping settings and make the defaults match the prototype (guides off, grid on).
5. **Insert box + Frame panel**: every Insert item that has an engine command inserts the element on the canvas (`insertCommands.ts` maps; items without a command: list them in the audit, do not fake). Frame presets and the custom size insert a frame via `addFrame` and select it; verify.
6. **Toolbar**: Select, Hand, Frame, Shape (and its items), Pen, Pencil, Text, Insert, AI all set the real active tool in the engine and the stage reacts. `pen` is marked `available:false` in core: do not hack it, record it under "Engine changes requested".
7. **Layers panel and Motion track column**: selection, rename, visibility, lock, reorder and group collapse go through the real document; selection stays in sync between Layers, canvas, inspector and the Motion timeline. Fix the layer id mismatch in the motion model (a layer shows as `el_buy_button` in the timeline while the layers panel calls it "Get started" and selecting it highlights no row).
8. **Text editing**: main's `InlineTextEditor` replaced ours, so Bold/Italic/Underline shortcuts (Ctrl+B/I/U) stopped working while editing text. Restore them through the editor's text-editing context, and make the text format bar write through it.
9. **Position section Constraints block** was auto-merged in the old style: leave its look, make sure it writes through the engine.
10. **e2e selectors**: where `tests/e2e/**` specs break because of rebuilt DOM, add the missing `data-testid`/ids on the components (do not edit the product behaviour for tests), then update specs only if a selector truly moved.

## Done when
- Each item above is either wired and verified in the browser (state what you clicked and saw) or listed under "Not done / blocked" with the exact reason.
- `npx tsc --noEmit` passes once at the end. No other checks (the orchestrator runs lint/build/e2e per phase).
- Screenshots of any control you changed, at 1440 wide, in `DOCS/UI/handoffs/screenshots/w1/` (headless Playwright only, one browser at a time, close it after).
- Handoff `DOCS/UI/handoffs/2026-11-10-HHMM-W1.md` from `DOCS/UI/handoffs/TEMPLATE.md`. No handoff, no pass.
