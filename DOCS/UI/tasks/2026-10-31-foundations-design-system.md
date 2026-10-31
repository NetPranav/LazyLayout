# Worker task: Foundations and the design system page

- **Areas:** `foundations` and `design-system` in `DOCS/UI/PARITY.md`. Set both to `done` when finished.
- **Bridges replaced:** none. Nothing in the running editor changes in this task.
- **Read first:** `AGENTS.md`, `DOCS/UI/UI_RULES.md`, `DOCS/UI/PALETTE.md`, `src/editor/styles/tailwind.css`, `src/editor/styles/tokens.css`, and the Next.js guides in `node_modules/next/dist/docs/` for pages and CSS.

## Design direction (from Claude, senior designer)

Calm and exact, like a precision instrument. Soft gray, white raised surfaces, thin hairlines and very little black. **Restraint is the whole look.** The quality shows in alignment, spacing and how controls respond.

### Foundations

Add these to `tokens.css` and the `@theme` block in `tailwind.css`. They are the only scales from now on.

- **Type:** the app's existing Inter (`--font-inter`), with its JetBrains Mono (`--font-jetbrains-mono`) only for numbers and code. Sizes 11, 12, 13, 14, 16, 20, 28, 40 px. Weights 400, 500, 600. Base UI text is 13.
- **Spacing:** a 4 px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
- **Radii:** 4 (small controls), 6 (controls), 8 (popovers, cards), 12 (panels). Nesting must look concentric. Nothing fully rounded except avatars.
- **Control heights:** 24 (dense), 32 (default), 40 (large).
- **Borders and shadows:** a 1 px hairline using `--ll-neutral-200`, and on gray surfaces a slightly stronger one using `--ll-neutral-400`. Two soft black shadows at low alpha: `raised` for cards and bars, `overlay` for menus and dialogs.
- **Motion:** durations 120, 200, 320 ms. One standard ease `cubic-bezier(0.2, 0, 0, 1)`. Use `motion` springs (no visible bounce) for moving indicators, and CSS transitions for hover and press.
- **Icons:** `lucide-react`, stroke width 1.75, sizes 16 and 20.
- **Semantic tokens:** map roles onto the neutrals so components never name a raw step: surface-raised, surface-bar, surface-canvas, surface-panel, text-primary, text-secondary, text-on-dark, border-hairline, border-strong.

### How color is used in components

- Black is for **one primary action per view**, nothing else. Do not use black for selected tabs or toggled options.
- Selected state in tabs, segmented controls and lists: a white raised fill with a hairline and primary text, on a gray track.
- Hover: one step lighter or darker neutral. Press: `transform: scale(0.98)`.
- Focus ring: 2 px black with a 2 px offset, on `:focus-visible` only.
- Error, warning and success have no colors: use an icon plus text.
- `#929292` is never text.

### Components

Build each in `src/editor/components/<name>/`, with variants and sizes as props. Use other sites as a source where it speeds things up, following `UI_RULES.md` §5. Radix-style accessibility behaviour is the bar for menus, dialogs and tooltips, but do not add packages.

1. **Button:** primary, secondary (white, hairline), ghost. Sizes 24, 32, 40. Leading icon, loading and disabled states.
2. **IconButton:** square, with a required `aria-label`.
3. **Input** and **NumberInput:** label, hint, error, mono digits for numbers.
4. **Select.**
5. **Checkbox.**
6. **Switch:** rectangular with radius 4, not a pill. The thumb moves with `transform`.
7. **SegmentedControl:** the selected thumb slides with `transform` and a `motion` spring.
8. **Tabs:** the indicator slides the same way.
9. **Slider.**
10. **Tooltip:** short delay, small dark surface.
11. **Menu:** dropdown with sections, shortcuts, submenus and full keyboard use.
12. **Dialog:** focus trap, Escape, solid surface with a translucent scrim.
13. **Badge:** radius 4, never a pill.
14. **Kbd:** keyboard shortcut chip.
15. **Panel** and **Divider:** the surface building blocks.

### The design system page: `/design-system`

- Route: `src/app/design-system/page.tsx`, with `src/editor/design-system/` holding the page's components. Return `notFound()` unless `labsEnabled` from `src/app/editor/labsEnabled.ts` is true. Copy the stage-lab page's pattern.
- **Layout:** a fixed left nav 240 wide, on `surface-panel`, with a hairline on its right. It holds Foundations and Components groups, with the current section highlighted. The content is a single column with a maximum of 960, on `surface-canvas`, with 64 between sections and 80 padding on top.
- **Foundations section:** color swatches with hex and token name, then the type scale, spacing, radii, shadows, and a live motion demo.
- **Each component section:** title, one-line purpose, then a white raised stage showing the component, then a row of controls to switch its variant, size and state. Below that, a static grid of all states side by side, including forced hover, focus and disabled, so a screenshot shows them all.
- **Copy:** plain and short. No marketing text.
- Responsive: below 1024 the nav collapses to a top menu.

## Files you may touch

- `src/editor/components/**`, `src/editor/design-system/**`, `src/app/design-system/**`
- `src/editor/styles/tokens.css`, `src/editor/styles/tailwind.css`
- `DOCS/UI/PARITY.md`, `INTEGRATION.md`, `DECISIONS.md`, `COMPONENT_SOURCES.md`, your handoff and screenshots

**Off limits:** everything in `UI_RULES.md` §4, plus `src/editor/styles/globals.css`, `src/app/layout.tsx` and every bridge file. Legacy global CSS is loaded on this page too. If it disturbs a component, set the component's own styles, and do not change the legacy CSS.

## Done means

- All 15 components work and are on the page with all their states, keyboard use included.
- Screenshots at 1440, 1024 and 390 in `DOCS/UI/handoffs/screenshots/foundations-design-system/`: the top of the page, the foundations, and every component section. Run the dev server for this and stop it when you finish.
- `npx tsc --noEmit` passes.
- The handoff, `DECISIONS.md` (who decided: you, for anything this task left open), `COMPONENT_SOURCES.md` and `INTEGRATION.md` are updated. Do not commit or push.
