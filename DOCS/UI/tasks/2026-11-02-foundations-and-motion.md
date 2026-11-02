# Task: foundations and motion engine from the prototype

- **Area:** `foundations` and `design-system` rows in `DOCS/UI/PARITY.md` (Phase 1)
- **Given by:** Claude (senior designer), 2026-11-02
- **Reference (source of truth):** `DOCS/UI/design/editor-design-mode-blocks-dark.html`. Open it with headless Playwright and read its CSS and script. Everything in this task copies the prototype's values into the real app.

## Goal

The real app gets the prototype's foundations, so every later screen task can build straight from the prototype: theme tokens, type, spacing, radii, shadows, and the Nook spring motion engine as a typed module. All of it is shown on `/design-system`. No app screens change in this task.

## 1. Theme tokens (`src/editor/styles/tokens.css`, `src/editor/styles/tailwind.css`)

- Replace the earlier dark and light colors with the **five official themes in `DOCS/UI/PALETTE.md`**: Paper (default), Dark, White, Warm, Lilac. Use exactly the semantic token names and values in `PALETTE.md` (`--ll-surface-*`, `--ll-text-*`, `--ll-control-*`, `--ll-select-*`, `--ll-ship-*`, `--ll-avatar-*`, `--ll-board-*`, `--ll-placeholder`, `--ll-swatch-line`, `--ll-thumb-*`, `--ll-shadow-soft`, accent only on Lilac).
- Do NOT add Graphite, Darkroom, Plum or Noir: they are candidates, not official.
- Theme switch: `data-theme` on `<html>`, Paper when nothing is stored. Keep the existing no-flash inline script in `src/app/layout.tsx` and the localStorage key, and change its default from dark to Paper. Update `ThemeToggle` to cycle or pick the five themes (a menu of five is fine; keep it simple).
- Map the tokens into the Tailwind `@theme` block so classes like `ll:bg-surface-panel` work. Remove tokens nothing uses any more, and fix any existing component that used a removed token.

## 2. Non-color foundations

Read them off the prototype (its root CSS and the components) and make them tokens with the `--ll-` prefix, plus Tailwind theme entries:
- **Type scale:** the sizes, weights and line heights the prototype uses (panel labels, row text, section headings, menu items, shortcut hints, top bar). Font stays Geist.
- **Spacing:** the prototype's grid (row heights, paddings, gaps). One scale, no one-off values.
- **Radii:** the prototype's modest radii (controls, menus and popovers, panels, cards). Concentric where nested. No pills.
- **Shadows:** `--ll-shadow-soft` per theme from `PALETTE.md`, and any other shadow level the prototype uses.
- **Sizes:** right panel width 320px, left panel width, top bar height, toolbar button size, menu width: as layout tokens.
Log the scales in `DECISIONS.md` as chosen by the worker.

## 3. Motion engine (`src/editor/motion/`)

Port the prototype's Nook engine to TypeScript. The prototype's engine block starts at the comment "Spring engine ported from Nook (the owner's own product)". The original typed source is the user's own product at `E:\Projects\Products\nook` (read only): `src/features/island/engine/spring.ts`, `loop.ts`, `engine.ts`, `layerMotion.ts`, `src/lib/motion.ts`, `src/lib/motionPresets.ts`, and the `island` block in `src/lib/tokens.ts`. Copy their structure and values. Do not tune values.

Files (names may vary, keep it small and clear):
- `spring.ts`: `Spring` (mass 1, response + damping ratio, retarget keeps velocity, semi-implicit Euler, `atRest`, `snap`, `jump`, `tune`), `stepAll`, `settleAll`.
- `loop.ts`: one rAF loop that runs only while a spring is moving (maxStep 0.032 s, 4 substeps).
- `presets.ts`: `MOTION_PRESETS` (smooth, lively, bouncy), exactly Nook's values, plus the island constants the prototype uses (width/height/press springs, wind-up 70 ms, entry bouncy 1000 ms, exit bouncy 600 ms, press scale 0.96, exit 120 ms blur 8 scale .85).
- `ease.ts`: `springEase(response, ratio)` → `{ easing: "linear(...)", duration }` cached, and `springAnim(el, keyframes, response, ratio, opts)` with the reduced-motion fallback (120 ms opacity fade).
- `flip.ts`: `measureFlip`, `playFlip`, `flipCard`.
- `surface.ts`: the prototype's `Surf` (Nook's `IslandEngine` reduced to a box): W, H, R, P springs, `shapeTo` with wind-up and `enterKick`, `punch`, `squash`, `glide`, `endBump`, `bump`, `press`; it writes size/radius/scale straight to the element per frame and clears inline sizes at rest. Include the size scale `k = min(1, height / 140)` the prototype uses for wind and kicks.
- `feel.ts` (or a small React hook): the active feel (Smooth default, Lively, Bouncy), stored in localStorage inside try/catch, plus `prefersReducedMotion()`.
- `index.ts` exporting the above.
- A top-of-file comment in `spring.ts`: "Spring engine ported from Nook (the owner's own product)".
- Unit-testable pure functions where Nook has tests: `springEase` ends at exactly 1, overshoot about 3.6 % for (0.5, 0.72) and about 25 % for (0.28, 0.40). Add a small test only if the repo already has a unit test runner configured; do not add one.

No new dependencies. Framework-free core (works with plain elements); React glue only where needed.

## 4. Design system page (`src/editor/design-system/`)

Add or update the **Foundations** section:
- Colors: all semantic tokens in all five themes, with contrast ratios for text roles.
- Type scale, spacing scale, radii, shadows, layout sizes: each shown visually with its token name.
- **Motion:** a live demo. A Smooth / Lively / Bouncy segmented control; a button that opens a sample surface with the engine (wind-up, overshoot, rows entering, exit squash); wheel over it to see `endBump`; a press target; a row of three boxes showing the three feels side by side; a reduced-motion note. Credit line: "Motion engine ported from Nook (the owner's own product)".
- Theme picker for the page.

The route stays 404 in production unless labs are enabled, as now.

## Files you may touch

`src/editor/styles/**`, `src/editor/motion/**` (new), `src/editor/components/**` (only to fix token renames and the theme toggle), `src/editor/design-system/**`, `src/app/layout.tsx` (theme default only), `DOCS/UI/**` entries this task needs. Off limits as in `UI_RULES.md` §4.

## Done means

- Screenshots of `/design-system` (foundations and motion sections) at 1440, 1024 and 390 in Paper and Dark, in `DOCS/UI/handoffs/screenshots/foundations-and-motion/`.
- `PARITY.md` rows `foundations` and `design-system` updated (still `wip` for design-system if components remain).
- `DECISIONS.md` (who chose what), `COMPONENT_SOURCES.md` (Nook engine row already exists, update "Copied to"), `INTEGRATION.md` if anything changed.
- Handoff in `DOCS/UI/handoffs/` from `TEMPLATE.md`.
- No commit, no push, no full checks.
