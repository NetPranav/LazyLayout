# Task: Right panel parity: Design inspector

- **Given by:** Claude (build session), 2026-11-04. **Phase:** parity pass after the user's review: the built UI does not match the prototype.

- **Files you may touch:** `src/editor/shell/right-panel/**`, `src/editor/panels/details/**`, `src/app/design-system/right-panel/**`, `src/app/design-system/details/**`.
- **Known differences (verified by the build session; compare `proto-default.png` with the app):**
  1. **Section headers.** The prototype's sections have a plain title ("Position", "Layout", "Appearance", "Typography", "Fill", "Stroke", "Effects") with a small "…" menu on the right, **no chevron, no sub-label** ("TRANSFORM & OFFSET", "CONSTRAINTS & SPACING" do not exist in the prototype), thin dividers and generous padding. Fill, Stroke and Effects show a "+" add button on the header instead. Match header height, font size and weight, padding, the divider and the "…" and "+" buttons exactly. Keep keyboard access and `aria-expanded` only if the prototype section collapses; otherwise sections are always open.
  2. **Header.** The prototype's header shows the selected element's **type icon** (T for text, frame icon, box, image...) and its name at 18 px, then the eye and "…" buttons. No "Animated / Data bound" chips row unless the element has them (copy the prototype's rule).
  3. **Fields.** Position: align row (6 icon buttons in one segmented bar), then X, Y and rotation fields with leading letters or icons exactly as in the prototype. Layout: W and H fields, Fixed/Hug selects with the crop toggle on the right. Appearance: opacity (drop icon) and radius fields. Typography: the text content box, font select (Geist), weight and size, line height and letter spacing with icons, text-align segmented, then the size-mode row. Fill: swatch, hex, opacity, eye, minus. Our version shows "Mixed" values, a "Free / Stack / Grid" switch and a long alignment grid that the prototype does not show for a text layer. Show only what the prototype shows for the selected type (copy the prototype's `renderSelection` rules per element type).
  4. **Data.** Values must come from the real selected element (selection store). With nothing selected show the prototype's empty state. The build session's `/editor` shows "Mixed" everywhere right now; find out why (selection not set, or the inspector reading the wrong store) and fix it in your files.
  5. Fix the AI chat input focus ring (UI rules require a visible ring) and the "…" glyph for the header more button.
- Do not build the Motion or Code inspectors here (another worker).

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
