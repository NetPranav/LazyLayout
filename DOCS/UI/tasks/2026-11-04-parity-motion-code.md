# Task: Motion and Code mode parity: inspectors, timeline, code panel

- **Given by:** Claude (build session), 2026-11-04. **Phase:** parity pass after the user's review: the built UI does not match the prototype.

- **Files you may touch:** `src/editor/panels/timeline/**`, `src/editor/panels/code-view/**`, `src/app/design-system/timeline/**`, `src/app/design-system/code-view/**`, and new `src/editor/panels/inspectors/**` (with its own lab route `src/app/design-system/inspectors/page.tsx`, guarded by `labsEnabled`/`notFound`).
- **Known differences (verified by the build session; compare `proto-motion.png` and `proto-code.png` with the app in Motion and Code mode):**
  1. **Motion right panel.** The prototype shows a "Keyframe" inspector: header (icon + "Keyframe"), sections **Target** (element select, property select), **Timing** (At 00:01.20, value 0 100%, Dur 0.6s, Delay 0s), **Easing** (select "Ease out", the curve box, x1 y1 x2 y2 fields), **Playback** (segmented Off / Loop / Bounce), **Presets** (+). Ours is a list of accordion rows (Layer, Property, Time ...). Build `KeyframeInspector` in `src/editor/panels/inspectors/` wired to the selected keyframe in the real animation store, exported so the build session can mount it as the right panel's motion body.
  2. **Code right panel.** The prototype shows the file inspector: header (file icon + "Hero.tsx"), **Component** (Name, export select), **Output** (React / HTML / Vue segmented, styles select, file name), **Props** (+, rows with name field, type select, minus), **Dependencies** (+). Ours is an accordion list. Update `CodeInspector` (`src/editor/panels/code-view/`) to match and export it for mounting.
  3. **Timeline.** The prototype's bottom panel: transport (skip back, step back, play, step forward, loop), time "00:00:00 / 00:05:00", "Presets / Graph / Export" on the right, ruler 0s-5s, **no clip labels**, thin grey clip bars with black diamond keyframes, a **playhead** as a full-height black line with a top marker, and the left Tracks rows (Headline, Get started, Hero image) aligned with the lanes. Ours has labelled clips and different chrome. Match it, keep scrubbing, keyframe drag and add working.
  4. **Code bottom panel.** The prototype shows just the file name on the left ("Hero.tsx") with **Copy** and **Export** on the right, then the code with line numbers; ours has a row of file tabs. Match the prototype (keep the Console view reachable only if the prototype has it; otherwise list it).

## How to work (parity pass, strict)

This is a **parity pass**: the shipped UI differs from the prototype and the user wants it to look and behave the same. The reviewer diffs your result against the prototype, screenshot against screenshot.

1. **Capture the prototype yourself.** Open `DOCS/UI/design/editor-design-mode-blocks-dark.html` in headless Playwright (`chromium-1248` under `%LOCALAPPDATA%\ms-playwright`, `page.goto(pathToFileURL(...).href)`, viewport 1440x900) and screenshot the states of your area. Reference captures already exist in `DOCS/UI/handoffs/screenshots/parity/` (`proto-default.png`, `proto-motion.png`, `proto-code.png`, `proto-contextmenu-canvas.png`, `proto-contextmenu-layer.png`, `proto-ship.png`). Read them first.
2. **Capture the current app** at http://localhost:3000/editor the same way (the dev server is already running; never start `next dev` or `next build`).
3. **Write the difference list first** (in your handoff): every visible difference in layout, spacing, type, icons, labels, order, states, motion and behaviour. Then fix **every** item. Copy values from the prototype CSS and JS (grep the ids and classes); do not tune.
4. **Re-capture** after the fixes and save before and after images side by side in `DOCS/UI/handoffs/screenshots/<short-name>/`. Do not claim a fix you did not see in a screenshot.
5. Anything you cannot match (a read-only component, a missing engine command) goes under "Not done / blocked" with the reason. Do not hide gaps.

## Rules that matter here

Tailwind `ll:` prefix, variant order `ll:hover:`; tokens only (no arbitrary values, hex, px or ms literals; add `--ll-` tokens when the prototype uses a value that has none); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on every global class and id, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent surfaces; honour `prefers-reduced-motion`; every focusable control has a visible focus ring; reuse `src/editor/components` (`Button`, `IconButton`, `Menu`, `Select`, `SegmentedControl`); colors only from `DOCS/UI/PALETTE.md` through semantic tokens.

## Parallel batch rules (5 workers at once in the same working tree)

- Edit only the files under "Files you may touch". Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project; fix only your own errors and note the rest.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md` (put notes in your handoff). `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx`, `src/editor/motion/*` are read-only (need a change: write it under "Not done / blocked"). `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only; import their stores and commands.
- Do not edit `EditorShell.tsx` or `RightPanelConnected.tsx`; the build session mounts things.

## Done

`npx tsc --noEmit` once at the end (real output in the handoff), before/after screenshots, and the handoff `DOCS/UI/handoffs/2026-11-04-<time>-<short-name>.md` from `TEMPLATE.md`: the difference list with fixed / not fixed per item, props contract, what is wired. Be honest about what you did not verify. Do not commit or push.
