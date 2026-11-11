# Task A (L0b): foundation tokens and shared motion table

Read `DOCS/UI/tasks/2026-11-08-COMMON.md` first. **Wave A, runs alone.** You own the shared files.

## Goal
Bring the theme tokens, lane token blocks and the shared motion table up to the 2026-11-07 prototype.

## Read only these
P: theme blocks lines 73-88 (`--syn-*` per theme), 1126-1135 and the `--lbl-*` theme lines (grep `--lbl-1:` for all 8 sets with tints), `window.LLMotion` at line ~3039 and the motion preset table above it (grep `MOTION_PRESETS`). App: `src/editor/styles/tokens.css` (theme blocks start at line 165; lane blocks at 514+), `tailwind.css`, `animations.css`, `globals.css`, `src/editor/components/index.ts`, `src/editor/motion/{presets,feel,index}.ts`.

## Do
1. `tokens.css`: add `--ll-syn-kw/str/num/fn/tag/attr/type/punc/com` for all 8 themes, copied exactly from P lines 81-88. Replace `--ll-label-1..6` and `-tint` per theme with P's per-theme `--lbl-N` / `--lbl-N-tint` values (8 sets, exact). Confirm Warm and Darkroom are the default light/dark themes everywhere a default is chosen (theme store, `ThemeToggle`, picker order: Warm first in Light, Darkroom first in Dark, toggle Warm <-> Darkroom). Expose the syn tokens in the `@theme` block of `tailwind.css` the same way other colours are (utilities `ll:text-syn-kw` etc.).
2. Add new lane blocks (copy the existing marker style) in both `tokens.css` and `tailwind.css`: `B1 pickers`, `B2 layers`, `B3 inspector`, `B4 canvas`, `B5 chrome`, `B6 code`, `B7 motion`, `B8 topbar`. Move nothing out of the existing L-blocks. Seed with the lane tokens you can read straight from P: B1 (picker widths 304, popover gap 8, hairline), B4 (cursor sizes), B5 (spotlight width 560, row height 32), B7 none.
3. `src/editor/motion`: expose ONE shared spring preset table and the feel (Smooth/Lively/Bouncy) as in P's `window.LLMotion`: a typed `LLMotion`-like accessor (`getMotion()` returning the current preset, `feel`, `reduce`, `springEase(response, damping)`), exported from `motion/index.ts`. Reuse what exists; do not duplicate tables. Do not add a window global.
4. `components/index.ts`: add commented-out nothing; instead add export lines for the new components with their final file names so later lanes only create the files: `ColorPicker`, `FontPicker`, `FramePresetsPanel`, `OptionsPopover`. Create each as a minimal placeholder file exporting the component name (`export function ColorPicker() { return null; }` with the final prop types left to B1) so tsc stays green. B1 replaces them.

## Lane paths
`src/editor/styles/tokens.css`, `tailwind.css`, `animations.css`, `globals.css`, `src/editor/components/index.ts`, the four placeholder files `src/editor/components/{ColorPicker,FontPicker,FramePresetsPanel,OptionsPopover}.tsx`, `src/editor/motion/**`, theme default code in `src/editor/components/ThemeToggle.tsx` (default only).
