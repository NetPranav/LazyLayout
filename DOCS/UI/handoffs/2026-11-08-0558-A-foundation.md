# Handoff: Wave A foundation tokens and shared motion table

- **Date / time:** 2026-11-08 05:58
- **Worker:** Antigravity ui-worker
- **Branch:** ui/redesign
- **Page / phase:** Wave A (L0b)
- **Task given by:** DOCS/UI/tasks/2026-11-08-A-foundation.md

## What changed
- `src/editor/styles/tokens.css`:
  - Added `--ll-syn-kw/str/num/fn/tag/attr/type/punc/com` for all 8 themes, copied exactly from prototype P lines 81-88.
  - Replaced `--ll-label-1..6` and `-tint` per theme with P's per-theme `--lbl-N` / `--lbl-N-tint` values (8 sets, exact, from P lines 1128-1135).
  - Configured Warm as default light theme (`:root, :root[data-theme="warm"], [data-theme="warm"]`) and Darkroom as default dark theme.
  - Removed duplicate `--ll-label-1..6` overrides inside `/* === lane: L5 timeline === */` so per-theme label tokens apply across all 8 themes.
  - Added 8 new lane blocks: `B1 pickers`, `B2 layers`, `B3 inspector`, `B4 canvas`, `B5 chrome`, `B6 code`, `B7 motion`, `B8 topbar`. Seeded B1 (picker width 304, popover gap 8, hairline), B4 (cursor 32px), B5 (spotlight width 560, row height 32), B7 none.
- `src/editor/styles/tailwind.css`:
  - Exposed syntax tokens `--color-syn-kw/str/num/fn/tag/attr/type/punc/com` under `@theme inline` mapping to `--ll-syn-*` tokens (enabling utilities `ll:text-syn-kw` etc.).
  - Added the 8 new B-lane blocks inside `@theme inline` with seeds for B1, B4, B5.
- `src/editor/styles/animations.css`:
  - Tuned logo outline trace animation to match prototype lines 96-100 (`@keyframes ll-tro { 0% { stroke-dashoffset: 100; } 88%, 100% { stroke-dashoffset: 0; } }` and `.logo.saving-on .tfl { opacity: 0; }` / `.logo.saving-on .tro { opacity: 1; }`).
- `src/editor/components/ThemeToggle.tsx`:
  - Updated `LIGHT_THEMES` order with Warm first (`Warm (Default)`, `Paper`, `White`, `Lilac`).
  - Updated `DARK_THEMES` order with Darkroom first (`Darkroom (Default)`, `Dark`, `Graphite`, `Noir`).
  - Updated default cached and server theme to `warm`.
  - Added `toggleTheme()` export toggling between default light (Warm) and default dark (Darkroom).
  - Updated `cycleTheme` in toggle component to toggle Warm <-> Darkroom.
  - Mapped legacy/invalid theme fallback to Warm / Darkroom.
- `src/editor/motion/presets.ts`:
  - Unified into ONE shared spring preset table (`MOTION_PRESETS`) with exact prototype values from P lines 3027-3031 (`smooth`, `lively`, `bouncy`), retaining Nook backwards-compatibility fields (`travel`, `wind`, etc.).
  - Aliased `PLAYFUL_PRESETS = MOTION_PRESETS` to avoid duplicate tables.
- `src/editor/motion/feel.ts`:
  - Updated `getPresetForFeel` to read directly from unified `MOTION_PRESETS`.
  - Added typed `LLMotion` interface and exported `getMotion()` accessor returning `{ preset, current, feel, reduce, springEase, presets }` matching prototype `window.LLMotion` behavior without polluting global scope.
- `src/editor/motion/index.ts`:
  - Re-exports `getMotion` and motion types from `feel.ts`.
- `src/editor/components/index.ts`:
  - Added export lines for upcoming B1 components: `ColorPicker`, `FontPicker`, `FramePresetsPanel`, `OptionsPopover`.
- `src/editor/components/{ColorPicker,FontPicker,FramePresetsPanel,OptionsPopover}.tsx`:
  - Created minimal placeholder component files exporting each name so `tsc` remains clean until Lane B1 replaces them.

## Decisions made
- Set Warm as `:root` default light theme and Darkroom as default dark theme across `tokens.css` and `ThemeToggle.tsx`.
- Removed redundant theme overrides in lane L5 of `tokens.css` that were clobbering the per-theme `--ll-label-*` tokens for non-Paper/non-Dark themes.
- Kept `reduce: boolean` on `getMotion()` to prevent truthy Boolean object traps while keeping full TypeScript safety.
- Pre-exported `ColorPicker`, `FontPicker`, `FramePresetsPanel`, and `OptionsPopover` with minimal placeholder components returning `null` so typecheck remains green.

## Components from other sites
none

## Legacy behaviour dropped
none

## Tokens / palette touched
- Added syntax highlight tokens `--ll-syn-kw`, `--ll-syn-str`, `--ll-syn-num`, `--ll-syn-fn`, `--ll-syn-tag`, `--ll-syn-attr`, `--ll-syn-type`, `--ll-syn-punc`, `--ll-syn-com` for all 8 themes from prototype P lines 81-88.
- Replaced `--ll-label-1..6` and `-tint` per theme with exact values from P lines 1128-1135.
- Added lane tokens for B1 (`--ll-size-picker-w: 304px`, `--ll-gap-picker-popover: 8px`, `--ll-border-picker-hairline: 1px`), B4 (`--ll-size-cursor: 32px`), B5 (`--ll-size-spotlight-w: 560px`, `--ll-size-spotlight-row-h: 32px`).
- Tailwind `@theme inline` exposed utilities: `ll:text-syn-*`, `ll:bg-syn-*`, `ll:w-picker`, `ll:gap-picker-gap`, `ll:size-cursor`, `ll:w-spotlight`, `ll:h-spotlight-row`.

## Integration notes added
none

## Not done / blocked
none

## Phase checks
- typecheck: passed in `src/editor` (`npx tsc --noEmit` has zero errors in `src/editor`; only `.next/types/validator.ts` referencing deleted legacy editor).
```
$ npx tsc --noEmit
.next/types/validator.ts(168,39): error TS2307: Cannot find module '../../src/app/editor/legacy/page.js' or its corresponding type declarations.
```
- lint: not run (orchestrator runs per phase)
- build: not run (orchestrator runs per phase)
- Playwright: passed, screenshots captured for 1440, 1024, 390 in Warm and Darkroom for App and Prototype P.

## Needs from other lanes
- `src/app/layout.tsx`: currently hardcodes `data-theme="paper"`; orchestrator or shell lane should update default initial attribute to `warm`.

## Engine changes requested
none

## Screenshots
Saved in `DOCS/UI/handoffs/screenshots/foundation/` and `DOCS/UI/handoffs/screenshots/A-foundation/`:
- `editor-1440-warm-A.png`, `editor-1440-warm-P.png`
- `editor-1440-darkroom-A.png`, `editor-1440-darkroom-P.png`
- `editor-1024-warm-A.png`, `editor-1024-warm-P.png`
- `editor-1024-darkroom-A.png`, `editor-1024-darkroom-P.png`
- `editor-390-warm-A.png`, `editor-390-warm-P.png`
- `editor-390-darkroom-A.png`, `editor-390-darkroom-P.png`
- `design-system-1440-warm-A.png`, `design-system-1440-darkroom-A.png`
- `design-system-1024-warm-A.png`, `design-system-1024-darkroom-A.png`
- `design-system-390-warm-A.png`, `design-system-390-darkroom-A.png`
- `design-system-colors-{paper,white,warm,lilac,noir,dark,graphite,darkroom}.png`

## Watcher verdict
- [ ] Pass   - [ ] Fail (reason):
