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

## Retry 1: review failed (2026-11-03), fix all of these

1. Lint errors in changed files (run `npx eslint` on the changed files until clean):
   - `src/editor/motion/loop.ts:18,20`: raw `requestAnimationFrame` / `cancelAnimationFrame` are banned outside `src/core/time/**`. Run the loop through `frameScheduler` from `src/core/time/scheduler.ts` (import only, never edit it), or inject it through a `FrameHost`.
   - `src/editor/motion/feel.ts:83`: no setState inside `useEffect`. Use a lazy `useState` initialiser or `useSyncExternalStore`.
   - `src/editor/design-system/MotionDemo.tsx:11`: remove the unused `prefersReducedMotion` import.
   - `src/editor/components/ThemeToggle.tsx:39`: fix the setState-in-effect error.
2. No hardcoded colors in components: remove the hex values and inline colors in `ThemeToggle.tsx` (19-23, 154-157) and `DesignSystemPage.tsx` (palette copy 147-401, contrast table 406-445, theme switcher ~1003, swatches 1059-1136). Render each theme's swatches inside a wrapper with `data-theme={id}` and use the semantic `ll:` classes. Read the shown hex values and compute contrast ratios from the live tokens (`getComputedStyle`), so the page cannot drift from `tokens.css`.
3. Replace inline sizes with tokens: `MotionDemo.tsx:212` (`width: 260`), `DesignSystemPage.tsx:1330` (`${step.px}px`). Also replace `ll:w-[1440px]`, `ll:w-[1024px]`, `ll:w-[390px]` (around lines 1907-1948) with tokens.
4. Map every `--ll-size-*` layout token and the `--ll-text-*-weight` tokens into the Tailwind `@theme` block, so classes like `ll:h-topbar` and `ll:w-panel` exist.
5. Delete the unused tokens `--ll-radius-sm-value`, `--ll-radius-md-value`, `--ll-radius-lg-value`, `--ll-shadow-soft-value` (all themes) and `--ll-canvas-max-width-value`.
6. `MotionDemo.tsx:125` shows raw LaTeX ("(\(T\))", "(\(\zeta\))"). Write plain words: "response (seconds) and damping ratio".
7. `src/editor/motion/surface.ts` `reset()`: call `simRemove(this.sim)` as the prototype does.
8. Move the `prefersReducedMotion` import in `ease.ts` to the top, and put `prefersReducedMotion` in its own module so `ease.ts` and `feel.ts` do not import each other.
9. Theme switcher on the design system page: show the selected state for the active theme.
10. Retake the 390 motion screenshots (Paper and Dark) so they show the motion demo itself, and add one screenshot with the sample surface open.
11. Correct the handoff: Dark's `--ll-accent` is `transparent` (only Lilac has an accent). Add a "Retry 1" section to the same handoff listing what you fixed.

## Retry 2: second review failed (2026-11-03), fix all of these

Retry 1 fixed 7 of 11 items. Remaining and new:

1. **Hydration mismatch** (every screenshot shows the Next dev badge "2 Issues"). Lazy `useState` initialisers read browser-only values on the first render while the page is server-rendered: `DesignSystemPage.tsx:752` (`getInitialTheme`), `:753` (`readLiveThemeTokens`), `ThemeToggle.tsx:40` (theme and its `aria-label`), `feel.ts:73-74` (feel and reduced motion). Use `useSyncExternalStore` with a server snapshot (server: Paper, Smooth, no reduced motion, tokens "—"), and read live token values after mount through a subscription. Remove the unused `_setLiveTokens`. Must stay lint-clean (no setState in effects). Load the page in headless Playwright and confirm there is no hydration warning in the console and no dev "Issues" badge.
2. `DesignSystemPage.tsx:1285`: remove the inline `style={{ width: ... }}` and use `step.widthClass` (currently unused).
3. `src/editor/styles/animations.css`, `.ll-hl`: replace `height: 32px` with `var(--ll-size-row-h)`.
4. Theme switcher buttons: add `aria-pressed={isSelected}`. Retake all colors screenshots so the selected theme is visible (Dark selected in the dark ones).
5. Retake the 390 motion screenshots (Paper and Dark) scrolled so the surface demo and its trigger button are fully in view, and retake `foundations-motion-surface-open-390.png` with the whole open surface visible.
6. Handoff line 27: remove "Lilac accent in dark mode".
7. `DOCS/UI/INTEGRATION.md`: add an entry saying the motion loop depends on the engine's `frameScheduler` (`src/core/time/scheduler.ts`).
8. Small, do them too: `MotionDemo.tsx:217` close button needs a visible focus style; `MotionDemo.tsx:282-291` press tile must be a `button` reachable by keyboard (Space/Enter press); in `tailwind.css` remove duplicate aliases (keep one name each: `panel`, `viewport-desktop`, `sample-surface` style; update usages).

This is the last retry. Add a "Retry 2" section to the handoff.
