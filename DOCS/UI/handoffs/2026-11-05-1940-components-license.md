# Handoff: Replace Unverified Animate UI Components (Cursor & Scroll Fade)

- **Date / time:** 2026-11-05 19:40
- **Worker:** components-license
- **Branch:** `integrate/main-into-new-ui`
- **Page / phase:** Core Components & Design System (License verification blocker resolution)
- **Task given by:** User request (Worker components-license)

## Summary

The two remaining imported third-party components from Animate UI with unknown/unverified licenses (`Cursor` and `Scroll Fade`) have been completely removed and replaced with our own original, clean-room implementations built to Apple-level design standards and Lazy Layout design system rules:

1. **`Cursor` (`src/editor/components/Cursor.tsx`):**
   - Implements `CursorProvider`, `CursorContainer`, `Cursor`, `CursorFollow`, and `useCursor`.
   - Uses semantic tokens from `PALETTE.md` and `tokens.css` with strict `ll:` Tailwind prefixes (no arbitrary values, no hex/rgb, no px/ms literals in JSX attributes).
   - Preserves all exports, props, and motion contracts expected by callers and design system demos (`cursorX`, `cursorY` as `MotionValue<number>`).
   - Complies with Apple-level aesthetic: modest radii (`rounded-sm` 4px / `rounded-md` 8px, no pills / no `rounded-full`).
   - Fully honours `prefers-reduced-motion` with 120ms fade fallback and instant positioning.

2. **`Scroll Fade` (`src/editor/components/ScrollFade.tsx`):**
   - Implements `ScrollFade`, `useScrollFade`, and all associated orientation/edge options.
   - Replaced Animate UI's blur and element-shrinking transitions (which violated `UI_RULES.md` §1 & §7) with hardware-accelerated CSS `mask-image` opacity gradient edge fades (`var(--ll-spacing-8, 32px)`).
   - Dynamically senses scroll offsets via passive native listeners and `ResizeObserver`, supporting `vertical`, `horizontal`, and `both` orientation modes.
   - Gracefully clears masks when content fits without overflowing or when `enabled={false}`.

3. **Design System & Documentation Updates:**
   - Updated `src/editor/design-system/DesignSystemPage.tsx` to showcase all states (interactive sandboxes, role badges, side/align variants, vertical & horizontal scroll fades, and enabled toggle).
   - Deleted `src/editor/components/imported/cursor` and `src/editor/components/imported/scroll-fade`.
   - Updated `DOCS/UI/COMPONENT_SOURCES.md`: removed the unverified license blocker warning and third-party table rows; documented our replacement implementations on 2026-11-05.
   - Re-exported new components in `src/editor/components/index.ts`.

---

## What changed

- `src/editor/components/Cursor.tsx`: New original collaborative cursor provider, container, pointer, and follow badge components.
- `src/editor/components/ScrollFade.tsx`: New original CSS mask-image scroll edge fade component and `useScrollFade` hook.
- `src/editor/components/index.ts`: Re-exported `Cursor` and `ScrollFade` components.
- `src/editor/design-system/DesignSystemPage.tsx`: Pointed imports to `../components/Cursor` and `../components/ScrollFade`; updated `CursorDemo` and `ScrollFadeDemo` to showcase all interactive and static states.
- `src/editor/components/imported/cursor/index.ts`: Deleted unverified Animate UI re-export.
- `src/editor/components/imported/scroll-fade/index.ts`: Deleted unverified Animate UI re-export.
- `DOCS/UI/COMPONENT_SOURCES.md`: Removed unverified license blocker note and Animate UI table rows; logged clean replacement on 2026-11-05.

---

## Decisions made

- Replaced Animate UI's 4px blur and per-item shrink effects with pure CSS `mask-image` opacity gradients to strictly respect `UI_RULES.md` §1 ("No glass, blur or translucent materials") and §7 ("Blur may go on moving content, never on a surface").
- Followed React 19 / React Compiler rules: avoided accessing refs during render by initializing stable MotionValues via `useState(() => motionValue(0))` and memoizing context values.
- Retained `#imported-cursor` and `#imported-scroll-fade` section IDs in `DesignSystemPage.tsx` to maintain backward URL hash compatibility with automated visual testing and bookmark links while updating UI titles to reflect native components.

---

## Components from other sites

- `none` (Deleted third-party unverified components; replaced entirely with own clean-room implementations).

---

## Legacy behaviour dropped

- `none`

---

## Tokens / palette touched

- `none` (Used existing tokens: `--ll-spacing-8`, `--ll-dur-fade`, `--ll-dur-swap`, `--ll-control-primary-bg`, `--ll-control-primary-fg`, `--ll-surface-bar`, `--ll-surface-panel`, `--ll-surface-raised`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`, `--ll-border-color`).

---

## Integration notes added

- `none`

---

## Not done / blocked

- `none` (All requested tasks completed; blocker resolved).

---

## Phase checks

- typecheck: **passed** (`npx tsc --noEmit` exited with code 0)
- lint: **passed** (`npx eslint src/editor/components src/editor/design-system` exited with code 0, 0 errors, 1 pre-existing warning in `ModeTabs.tsx`)
- build: not run (worker rule: orchestrator runs build per phase)
- Playwright: **passed** (Before & after screenshots captured in headless Chromium for both sections across Paper and Dark themes at 1440x900)

---

## Screenshots

- `DOCS/UI/handoffs/screenshots/components-license/before-imported-cursor-paper.png`
- `DOCS/UI/handoffs/screenshots/components-license/before-imported-cursor-dark.png`
- `DOCS/UI/handoffs/screenshots/components-license/after-imported-cursor-paper.png`
- `DOCS/UI/handoffs/screenshots/components-license/after-imported-cursor-dark.png`
- `DOCS/UI/handoffs/screenshots/components-license/before-imported-scroll-fade-paper.png`
- `DOCS/UI/handoffs/screenshots/components-license/before-imported-scroll-fade-dark.png`
- `DOCS/UI/handoffs/screenshots/components-license/after-imported-scroll-fade-paper.png`
- `DOCS/UI/handoffs/screenshots/components-license/after-imported-scroll-fade-dark.png`

---

## Watcher verdict

- [ ] Pass   - [ ] Fail (reason):
