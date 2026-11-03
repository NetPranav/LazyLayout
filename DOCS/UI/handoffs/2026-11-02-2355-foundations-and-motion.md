# Handoff: Foundations & Motion Engine Rebuild

- **Date / time:** 2026-11-02 23:55 IST
- **Worker:** Antigravity worker session
- **Branch:** ui/redesign
- **Page / phase:** Phase 1 Foundations & Motion Engine (`src/editor/styles`, `src/editor/motion`, `/design-system`)
- **Task given by:** `DOCS/UI/tasks/2026-11-02-foundations-and-motion.md`

## What changed
- `src/editor/styles/tokens.css`: Updated `:root` with `paper` default theme, added 5 official themes (`paper`, `dark`, `white`, `warm`, `lilac`), semantic tokens (`surface`, `text`, `control`, `select`, `ship`, `avatar`, `board`, `placeholder`, `swatch-line`, `thumb`, `shadow-soft`), layout dimensions, typography scale, and 4px grid spacing tokens.
- `src/editor/styles/tailwind.css`: Rebuilt `@theme inline` block mapping all `--ll-*` tokens to Tailwind `ll:*` utility classes.
- `src/editor/styles/animations.css`: Added shared overlay animations and layout utilities (`.open`, `[data-lv]`, `[data-mv]`, `.ll-lay`, `.ll-hl`) ported from prototype.
- `src/app/layout.tsx`: Configured default `data-theme="paper"` on `<html>` and updated anti-flash head inline script to validate against the 5 official themes.
- `src/editor/components/ThemeToggle.tsx`: Completely updated to support the 5 official themes (`paper`, `dark`, `white`, `warm`, `lilac`) via accessible dropdown menu and cycle action with swatch previews.
- `src/editor/motion/spring.ts`: Analytical mass-1 spring physics simulator (`Spring`, `stepAll`, `settleAll`, `stiffnessOf`, `dampingOf`) ported from Nook.
- `src/editor/motion/presets.ts`: Motion presets (`smooth`, `lively`, `bouncy`) and animation presets (`SP`, `MOT`, `EXIT`) matching Nook values.
- `src/editor/motion/loop.ts`: Shared 60fps rAF frame loop coordinator (`createLoop`, `simAdd`, `simRemove`) with fixed substepping.
- `src/editor/motion/ease.ts`: `springEase` CSS `linear()` generator, `springAnim` with 120ms opacity fade fallback under reduced motion, and `cancelAll`.
- `src/editor/motion/feel.ts`: Feel state manager (`getFeel`, `setFeel`, `applyFeel`, `prefersReducedMotion`, `useFeel` hook) with localStorage persistence.
- `src/editor/motion/flip.ts`: FLIP transition helpers (`measureFlip`, `playFlip`, `flipCard`).
- `src/editor/motion/surface.ts`: Surface controller (`Surf`, `surf`, `wheelAttach`, `pressEl`, `enterRows`, `exitItems`) powering wind-up, kick, bulge, squash, glide, press, and drag physics.
- `src/editor/motion/index.ts`: Central export file for motion module.
- `src/editor/motion/__tests__/motion.test.ts`: Unit test suite verifying spring physics convergence, overshoot bounds, and CSS linear easing generation.
- `src/editor/design-system/MotionDemo.tsx`: Interactive motion showcase component with feel switch, live surface popover, interactive press target, and side-by-side feel comparison.
- `src/editor/design-system/DesignSystemPage.tsx`: Added `sizes` and `motion` navigation tabs, 5-theme token tables, contrast ratio verification, layout dimension previews, and motion engine demonstrations.
- `DOCS/UI/PARITY.md`: Updated `foundations` status to `done`.
- `DOCS/UI/DECISIONS.md`: Recorded worker decisions for 5 official themes, Nook spring engine port, and layout dimensions.
- `DOCS/UI/COMPONENT_SOURCES.md`: Documented Nook animation engine port details.
- `DOCS/UI/INTEGRATION.md`: Added note under Section 5 detailing five official themes and motion engine foundations.

## Decisions made
- Kept strictly to the 5 official themes (`paper`, `dark`, `white`, `warm`, `lilac`) from `DOCS/UI/PALETTE.md`; prototype candidate dark themes (Graphite, Darkroom, Plum, Noir) are excluded as per rules.
- Corrected `--ll-accent` in `dark` theme to `transparent` (only Lilac has an accent: `#CEB4F5`, as specified in `DOCS/UI/PALETTE.md`).
- Surface velocity scaling: used $k = \min(1, h / 140)$ for wind-up and kick velocities as implemented in prototype.
- Default theme set to `paper` (`data-theme="paper"`) on `:root` and `<html>`.

## Components from other sites
- Nook motion engine (from the owner's own product `E:\Projects\Products\nook`). Ported directly into `src/editor/motion/` (`spring.ts`, `presets.ts`, `loop.ts`, `ease.ts`, `feel.ts`, `flip.ts`, `surface.ts`).

## Legacy behaviour dropped
- none (foundations task).

## Tokens / palette touched
- `src/editor/styles/tokens.css`: All tokens updated to match `DOCS/UI/PALETTE.md` and `DOCS/UI/design/editor-design-mode-blocks-dark.html`. Added `--ll-surface-*`, `--ll-text-*`, `--ll-control-*`, `--ll-select-*`, `--ll-ship-*`, `--ll-avatar-*`, `--ll-board-*`, `--ll-placeholder`, `--ll-swatch-line`, `--ll-thumb-*`, `--ll-shadow-soft`. Non-color tokens: 4px grid spacing, modest radii (4px, 6px, 8px), typography scale, 16 layout dimension tokens (`--ll-topbar-h`, `--ll-panel-w`, `--ll-rail-w`, etc.).

## Integration notes added
- Added "Themes and Motion Foundations (Phase 1)" under Section 5 in `DOCS/UI/INTEGRATION.md`.

## Not done / blocked
- none

## Phase checks
- typecheck: passed (`npx tsc --noEmit` exited 0)
- lint: not run (full checks not run mid-phase as per instructions)
- build: not run (full checks not run mid-phase as per instructions)
- Playwright: passed (headless screenshots captured via Playwright at 1440, 1024, 390 in Paper and Dark themes; unit tests passed: `npx tsx --test src/editor/motion/__tests__/motion.test.ts` 4/4 passed)

## Screenshots
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-paper-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-paper-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-paper-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-dark-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-dark-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-colors-dark-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-paper-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-paper-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-paper-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-dark-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-dark-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-sizes-dark-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-paper-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-paper-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-paper-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-dark-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-dark-1024.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-dark-390.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-surface-open-1440.png`
- `DOCS/UI/handoffs/screenshots/foundations-and-motion/foundations-motion-surface-open-390.png`

## Retry 1 (2026-11-03)

### What was fixed
1. **ESLint clean**:
   - `src/editor/motion/loop.ts`: Replaced raw `requestAnimationFrame`/`cancelAnimationFrame` with `frameScheduler` imported from `src/core/time/scheduler.ts` (Phase 55 integration).
   - `src/editor/motion/feel.ts`: Eliminated synchronous `setState` in `useEffect` using lazy `useState` initializers.
   - `src/editor/design-system/MotionDemo.tsx`: Removed unused `prefersReducedMotion` import.
   - `src/editor/components/ThemeToggle.tsx`: Removed `mounted` state and synchronous `setState` within effect.
2. **Eliminated all hardcoded colors and inline hex**:
   - `ThemeToggle.tsx`: Removed hex palette table (`#F4F3EF`, `#2C2C2C`, etc.) and inline style bindings; theme swatches now render inside a `data-theme={t.id}` wrapper using `ll:bg-surface-panel` and `ll:border-swatch-line`.
   - `DesignSystemPage.tsx`: Removed hardcoded hex values in `SEMANTIC_ROLES` and `CONTRAST_DATA`. Swatches render inside `<div data-theme={themeId}>` with semantic `ll:` classes (`ll:bg-*`).
   - Dynamic token inspection: Hex values and WCAG contrast ratios are now read directly from `getComputedStyle()` live tokens on mount, preventing any drift from `tokens.css`.
3. **Replaced inline and arbitrary sizes with tokens**:
   - `MotionDemo.tsx`: Replaced `style={{ width: 260 }}` with `ll:w-sample-surface`.
   - `DesignSystemPage.tsx`: Replaced `style={{ width: `${step.px}px` }}` with `style={{ width: `var(${step.token})` }}`.
   - Replaced arbitrary viewport classes `ll:w-[1440px]`, `ll:w-[1024px]`, `ll:w-[390px]` with semantic Tailwind tokens `ll:w-viewport-desktop`, `ll:w-viewport-tablet`, and `ll:w-viewport-mobile`.
4. **Tailwind `@theme` mapping**:
   - Mapped all `--ll-size-*` layout dimensions into `@theme inline` (`--spacing-*`, `--height-*`, `--width-*`), creating utilities `ll:h-topbar`, `ll:w-panel`, `ll:w-viewport-desktop`, etc.
   - Mapped all typography weights `--ll-text-*-weight` to `--font-weight-*`.
5. **Deleted unused tokens**:
   - Removed `--ll-radius-sm-value`, `--ll-radius-md-value`, `--ll-radius-lg-value`, `--ll-canvas-max-width-value`, and `--ll-shadow-soft-value` across all themes in `tokens.css`.
6. **Prose cleanup in MotionDemo**:
   - Replaced raw LaTeX string ("(\(T\))", "(\(\zeta\))") on line 125 with plain words: "response (seconds) and damping ratio".
7. **Surface reset physics**:
   - Added `simRemove(this.sim)` to `src/editor/motion/surface.ts` `reset()` matching prototype behavior.
8. **Decoupled reduced motion module**:
   - Created `src/editor/motion/reducedMotion.ts` to house `prefersReducedMotion` and its media query listener, breaking the circular dependency between `ease.ts` and `feel.ts`. Moved import to top of `ease.ts`.
9. **Active theme indicator**:
   - Theme switcher on `/design-system` now displays active theme selected styling with checkmark.
10. **Screenshots retaken**:
    - Retook `foundations-motion-paper-390.png` and `foundations-motion-dark-390.png` with mobile responsive nav drawer collapsed so the motion engine demo itself is immediately in view.
    - Added `foundations-motion-surface-open-1440.png` and `foundations-motion-surface-open-390.png` displaying the live physics sample surface open.
11. **Dark theme accent corrected**:
    - Clarified handoff: Dark's `--ll-accent` is `transparent`. Only Lilac has an accent (`#CEB4F5`).

### Not done / blocked
- none

## Retry 2 (2026-11-03)

### What was fixed
1. **Hydration mismatch eliminated via `useSyncExternalStore` and server snapshots**:
   - Replaced browser-only lazy `useState` initializers with `useSyncExternalStore` using deterministic server snapshots:
     - `DesignSystemPage.tsx`: `useTheme()` with server snapshot `"paper"`; token store subscribed via `useSyncExternalStore(subscribeLiveTokens, getLiveTokensSnapshot, getServerLiveTokensSnapshot)` with server snapshot mapping all tokens to `"―"`, populating live computed styles after mount. Removed unused `_setLiveTokens`.
     - `ThemeToggle.tsx`: `useTheme()` with server snapshot `"paper"`, ensuring theme and button `aria-label` match SSR HTML during hydration.
     - `feel.ts`: `useSyncExternalStore(subscribeFeel, getFeel, getServerFeel)` with server snapshot `"smooth"`.
     - `reducedMotion.ts`: `useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, getServerReducedMotion)` with server snapshot `false`.
   - Verified via headless Playwright: zero console hydration warnings/mismatch errors and zero dev "Issues" badge across all screenshots. Remained 100% lint-clean with zero `setState` inside effects.
2. **Spacing step inline style removed**:
   - `DesignSystemPage.tsx`: Removed inline `style={{ width: ... }}` and applied `step.widthClass` (`ll:w-1`, `ll:w-2`, etc.).
3. **Animations height tokenized**:
   - `src/editor/styles/animations.css`: `.ll-hl` height replaced from fixed `32px` to `var(--ll-size-row-h)`.
4. **Theme switcher buttons `aria-pressed`**:
   - Added `aria-pressed={isSelected}` to theme switcher buttons on the design system page. Retook all colors screenshots with the active theme selected state visible (Dark selected in dark screenshots with checkmark and active border/bg).
5. **Retaken 390 motion and surface screenshots**:
   - Retook `foundations-motion-paper-390.png` and `foundations-motion-dark-390.png` scrolled so Demo 1 (Surface Engine) and its "Open Sample Surface" trigger button are centered in view.
   - Retook `foundations-motion-surface-open-390.png` with the complete open surface popover (header, close button, interactive rows) fully visible in viewport.
6. **Handoff correction**:
   - Line 27 corrected to remove "Lilac accent in dark mode".
7. **Engine integration entry**:
   - Added entry to Section 2 of `DOCS/UI/INTEGRATION.md` documenting the motion loop's dependency on the core engine's `frameScheduler` (`src/core/time/scheduler.ts`).
8. **Small fixes & cleanup**:
   - `MotionDemo.tsx`: Close button has visible focus ring (`ll:focus-visible:outline-none ll:focus-visible:ring-1 ll:focus-visible:ring-primary ll:rounded-sm`).
   - `MotionDemo.tsx`: Press tile converted from `div` to accessible `<button type="button">` reachable by keyboard with Space/Enter press physics and visible focus ring (`ll:focus-visible:outline-none ll:focus-visible:ring-2 ll:focus-visible:ring-primary`).
   - `src/editor/styles/tailwind.css`: Removed duplicate layout aliases, retaining canonical tokens: `panel` (removed `panel-right`), `viewport-desktop`/`viewport-tablet`/`viewport-mobile` (removed `desktop`/`tablet`/`mobile`), and `sample-surface` (removed `surface-sample`).

### Not done / blocked
- none

## Watcher verdict
<!-- Claude fills this in. -->
- [x] Pass (after Retry 2, 2026-11-03). Retry 1 and the first run failed: lint errors, hardcoded colors, hydration mismatch. Minor notes moved to the core components task.

