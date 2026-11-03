# Task: Left panel parity: layers, files, tracks, assets

- **Given by:** Claude (build session), 2026-11-04. **Phase:** parity pass after the user's review: the built UI does not match the prototype.

- **Files you may touch:** `src/editor/shell/left-panel/**`, `src/editor/panels/layers/**`, `src/app/design-system/left-panel/**`, `src/app/design-system/layers/**`.
- **Known differences (verified by the build session; compare `proto-default.png`, `proto-motion.png`, `proto-code.png` with the app):**
  1. **Layers tree.** The prototype shows the whole tree expanded by default (Hero > Headline, Subtitle, Get started, Hero image; Features; Footer; Other elements with its 10 children) with **type icons per element** (T, box, image, circle, star, line, frame #), indentation chevrons, a selected row with a grey fill and a small motion badge on animated rows (Headline, Get started). Ours shows only a collapsed "RootContainer". Make the real document's tree render with the correct icon per element type and a sensible default expansion (the first frame expanded), selected row styling and the motion badge for elements that have animation.
  2. **Row metrics** (height, indent step, icon size, font size and color, hover fill) from the prototype CSS `#p-layers` rows.
  3. **Motion mode.** The prototype's left panel shows Layers on top and a **Tracks** list below (Headline, Get started, Hero image) with a "Tracks" header; check ours against `proto-motion.png`.
  4. **Code mode.** The Files tree (src > components > Hero.tsx, Features.tsx, Footer.tsx; pages > Home.tsx; styles > globals.css; package.json) with folder and file icons and the selected row; ours shows "src" and "package.json" only. Build the tree from the real generated files (the compiler output the code view reads) and make it match.
  5. **Assets** section at the bottom (header "Assets >", plus and search buttons): check metrics and the expanded state.
  6. Selection must stay in sync with the stage and the inspector through the selection store.

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
