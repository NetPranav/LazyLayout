# Task: core components from the prototype

- **Area:** `design-system` row in `DOCS/UI/PARITY.md` (Phase 1), and the base for `menus`
- **Given by:** Claude (senior designer), 2026-11-03
- **Depends on:** `2026-11-02-foundations-and-motion.md` (tokens and `src/editor/motion/` exist)
- **Reference (source of truth):** `DOCS/UI/design/editor-design-mode-blocks-dark.html`. Open it with headless Playwright, inspect each element and copy its size, spacing, type, radius, states and motion into tokens and components. Do not invent a different look.

## Goal

Build every reusable component the editor screens need, as React components in `src/editor/components/`, each on `/design-system` with all its states and variants. After this task, a screen task only assembles these. No app screen changes in this task.

## Components (match the prototype exactly; names are suggestions)

**Buttons and controls**
1. `Button`: rebuild the existing one to the prototype: primary (`--ll-control-primary-*`), secondary, ghost; sizes sm and md; states default, hover, focus ring, pressed (Nook press spring, scale .96), disabled, loading. Rectangular, modest radius, no pill.
2. `IconButton` (prototype `.ib`): square, one lucide icon at one stroke weight, `aria-label` required, tooltip on hover, pressed/toggled state (`aria-pressed`, `--ll-control-active`).
3. `SegmentedControl` (prototype `.seg`, the mode switch Design/Motion/Code, Free/Stack/Grid, Smooth/Lively/Bouncy): boxed, active marker slides between options on a Nook spring (glide springs), keyboard arrows, text or icon options.
4. `Toggle` (prototype `.tg`): rectangular track, knob springs across (bouncy pop on change), on/off/disabled, label.
5. `Checkbox`: check mark pops in on a spring, indeterminate state.
6. `Tooltip`: rebuild to the prototype style; delay, keyboard focus shows it.

**Fields**
7. `TextField` (prototype `.field`): label, placeholder, focus, error text, disabled.
8. `NumberField` with scrub (prototype number fields with a short label, e.g. X, Y, W, H, rotation): drag on the label to scrub, arrow keys step, shift for x10, units suffix, mixed value. Reuse scrub math from `@/legacy-editor` (`panels/details/controls/ScrubNumber*.tsx`) for behaviour only.
9. `Select` / dropdown field: opens a `Menu` (below).
10. `ColorSwatchField` (prototype fill row swatch + hex + opacity): swatch, hex input, opacity number. The full color picker comes later.

**Menus and overlays (use the engine in `src/editor/motion/`, exactly as the prototype menus behave)**
11. `Menu`, `MenuItem`, `MenuSeparator`, `MenuLabel`, `SubMenu`: the prototype's logo menu and context menus. Icon, label, shortcut hint, chevron for submenus, checked state, disabled state, danger-free (no red). Behaviour from the prototype: one surface per menu driven by `Surf` (wind-up, overshoot, rows enter by blocks, exit squash), the single spring highlight that follows hover and keyboard, press spring on rows, wheel over a menu with nothing to scroll calls `endBump` with the deck lock, submenus as their own surface with the 100 ms open / 200 ms close hover delays and the safe triangle, parent dims while a submenu is open, Escape and outside click close, arrow keys, Enter, type-ahead, focus returns to the trigger, `role="menu"` semantics. A menu click runs its action immediately while the exit plays.
12. `ContextMenu`: the same `Menu` opened at the pointer.
13. `Popover`: the prototype's settings popover and View options popover: anchored, same surface engine, focus trap, Escape.
14. `CommandPalette` (prototype Ctrl+K): dialog with search field and result list using the same rows and highlight.

**Panels and rows**
15. `PanelSection` (prototype `.sec`): header with title, optional `...` button that reveals the advanced block (`.dmore`), add (+) button; collapsible.
16. `PropertyRow` (prototype `.prow`, `.dpair`, `.dgrid`): label + one or two controls on the prototype grid.
17. `ListRow` (prototype one-line Fill/Stroke/Effects/Animation/Data/Logic rows): drag handle, swatch or icon, name, value, visibility toggle, remove; drag to reorder with FLIP (`flipCard`); opens a `Popover` for its settings.
18. `TreeRow` (prototype layer rows `.row`): indent, expand chevron (spring rotate), type icon, name with inline rename, hover, selected, range selected, hidden and locked states, motion badge, drop indicator for reorder and nest. Visual and interaction only; data comes later.
19. `Tabs` (left panel tabs in the prototype).
20. `Avatar` and `AvatarStack` (prototype `.av`), and the `ShipButton` (quiet until ready, ready state uses `--ll-ship-*`).
21. `EmptyState` (prototype Blank page empty state).

Replace the 12 imported components in `src/editor/components/imported/` only where one of these supersedes it; keep the imported ones that nothing replaces, and list which ones you removed or kept in the handoff (delete only inside `src/editor/components/imported/`).

## Rules for every component

- Tokens only, `ll:` Tailwind classes, no arbitrary values, colors only from `PALETTE.md` semantic tokens. Works in all five themes.
- Rectangular, modest concentric radii, hairline borders, soft shadow on floating surfaces. No glass, no blur materials, no pills.
- Motion only through `src/editor/motion/` springs and the active feel (Smooth default). Reduced motion: short opacity fade, no springs.
- Keyboard and screen reader: correct roles, visible focus ring, labels, 4.5:1 text contrast.
- Typed props, controlled and uncontrolled where it makes sense. No dead code, no TODO.
- Export everything from `src/editor/components/index.ts`.

## Design system page

Add a **Components** section with one entry per component: every state (default, hover, focus, active/pressed, disabled, loading, error, selected, where they apply), every variant and size, and a live playground (try variants, sizes, feel). Menus show the logo menu from the prototype with its submenus, a context menu area to right-click, and a long menu to test scrolling and `endBump`.

## Fixes from the foundations review

Apply the fixes Claude lists here after reviewing worker 1:
- One icon stroke weight everywhere: use 1.5 for every lucide icon (`X` in `MotionDemo.tsx`, `Check` in `ThemeToggle.tsx` currently use 2). Make it a shared default.
- `MotionDemo.tsx` close button (around 217-224) is ~14px: give it the `IconButton` size and click target.
- `MotionDemo.tsx` dead hook classes `menu`, `ctx`, `row` (around 210-256): remove them, or replace the demo surface with the new `Menu` component.
- `MotionDemo.tsx` at 390 wide: the Demo 1 heading and the monospace hint crowd each other. Add a gap or stack them.
- `ThemeToggle.tsx`: menu items should be `menuitemradio` with `aria-checked`, with arrow-key navigation. Rebuild it on the new `Menu` component.
- The "Imported (as-is)" demos in `DesignSystemPage.tsx` still have hex values and classes without `ll:`. Fix them for any imported component you keep.
- Contrast: in Lilac and Warm, secondary and muted text on `--ll-select-bg` and `--ll-surface-hover` is below 4.5:1. Selected and hovered rows use `--ll-select-fg` / primary text only.

## Files you may touch

`src/editor/components/**`, `src/editor/design-system/**`, `src/editor/styles/**` (only to add tokens a component needs), `src/editor/motion/**` (only bug fixes, log them), `DOCS/UI/**` entries this task needs. Off limits as in `UI_RULES.md` §4.

## Done means

- Screenshots of the Components section at 1440, 1024 and 390, in Paper and Dark, plus one screenshot each of an open menu with a submenu, a popover and the command palette, in `DOCS/UI/handoffs/screenshots/core-components/`.
- `PARITY.md` `design-system` row updated, `DECISIONS.md` (who chose what), `COMPONENT_SOURCES.md` for anything taken from other sites, `INTEGRATION.md` if needed.
- Handoff in `DOCS/UI/handoffs/` from `TEMPLATE.md`.
- No commit, no push, no full checks.

## Retry 1: review failed (2026-11-03), fix all of these

1. **Submenus broken:** hovering "File" hides the whole menu and no submenu appears. React re-sets `className` (`Menu.tsx:321-323`) and wipes the classes `Surf` puts on the element; never let React own classes/styles that `Surf` writes (use a wrapper or data attributes). The parent's `overflow-y-auto` clips the submenu: portal submenus or move overflow to the inner layer.
2. **Submenu must be its own `Surf` surface** (`Menu.tsx:531-540`): wind-up, overshoot, rows in, exit squash, its own highlight and item registry (offsets are wrong now).
3. **Wire wheel `endBump` with the deck lock** (`wheelAttach` from `src/editor/motion/`) on every Menu, SubMenu, Popover and the CommandPalette list, as in the prototype.
4. **Menu keyboard:** focus moves into the menu on open, ArrowRight/ArrowLeft open and close submenus, type-ahead, focus returns to the trigger.
5. **No arbitrary Tailwind values** anywhere: `outline-offset-[-2px]` (Button, Checkbox, IconButton, SegmentedControl, Select, Toggle), `text-[10px]`/`[14px]`/`[16px]` (Avatar, TreeRow, IconButton), `pt-[15vh]`, `max-h-[70vh]`/`[60vh]`, `left-[calc(100%+4px)]`, `p-[2px]`/`gap-[2px]`/`top-[2px]`/`bottom-[2px]`/`h-[2px]`/`top-[1px]`/`rounded-[2px]` (SegmentedControl, Tabs, Toggle), `shadow-[inset_…]` (TreeRow). Add tokens to `tokens.css` + `@theme` and use them.
6. **No hardcoded sizes:** `Menu.tsx` 195-203 and 290-299 px values, `Toggle.tsx` 121 and 132-136, `TreeRow.tsx:109` indent. Use tokens (`var(--ll-…)` or `ll:` classes); measured runtime positions are fine, constants are not.
7. **No palette copy:** remove `SERVER_LIVE_TOKENS` (`DesignSystemPage.tsx:319-480`); the server snapshot shows "—" and live values load after mount. `ElasticSlider.tsx` (102-103, 135, 174) and `ElasticSlider.css` (177-178): tokens only, or drop ElasticSlider (its license is unverified, so dropping it is preferred).
8. **One shared icon stroke:** a single `Icon` wrapper or shared default for lucide icons at 1.5; no hand-set `strokeWidth` per icon; nothing at 1.75.
9. **Base font:** Popover title, Toggle labels and any text rendering in a serif fallback need `ll:font-sans` (there is no Preflight).
10. **Closed menus:** mount on open (or `inert` + `aria-hidden` while closed); no hidden `role="menu"` nodes. Remove the dead `group-hover:ll:text-primary` (`Menu.tsx:425`).
11. **Screenshots:** Components section at 1440, 1024 and 390 in Paper and Dark (named correctly), and real shots of an open menu WITH its submenu open, the popover and the command palette. Check each image before claiming it.
12. **Status honesty:** `PARITY.md` `design-system` and `INTEGRATION.md` must not say done until menus work. Add a "Retry 1" section to the handoff.

## Retry 2: second review failed (2026-11-03), last retry

The tree does not compile: `npx tsc --noEmit` has 49 errors. A bulk edit at 12:34 mangled JSX in two files. Do not run any bulk reformat or search-and-replace across files. Run `npx tsc --noEmit` and `npx eslint` yourself, and paste their real output in the handoff before claiming anything.

1. `Toggle.tsx:115-140` and `TreeRow.tsx:106-135`: broken JSX (`< div`, `ref = { knobRef }`, `aria - hidden`, `aria- label`, `</button >`, stray `}}`). Restore both so they parse, and keep the tokenised TreeRow indent (item 6 of Retry 1).
2. Remove `SERVER_LIVE_TOKENS` (`DesignSystemPage.tsx:319-480`, used at 462, 477 and 482). The server snapshot shows "—", and live values load after mount.
3. Use the `Icon` wrapper for every lucide icon (64 hand-set `strokeWidth` props, for example `EmptyState.tsx:39`, `ListRow.tsx:65`, `TreeRow.tsx:128`, `TopBar.tsx:148`). `Check` (`Menu.tsx:582`), `ChevronRight` (`Menu.tsx:966`) and `Search` (`CommandPalette.tsx:166`) have no stroke set. Every icon goes through `Icon` at 1.5.
4. `TreeRow.tsx:140,178`: `group-hover:ll:` is the wrong order. Use `ll:group-hover:`, add a `ll:group` parent, and prefix `transition-opacity`.
5. Menu rows render as native grey buttons with unreadable white text. There is no Preflight, so reset each row button's background, border, color, font and padding with tokens. "File" must show a right chevron. Retake `menu-interactive-with-submenu.png` and LOOK at it.
6. `Menu.tsx:242-243,754` (`Math.max(8, …)`) and `:143` (`new Spring(32, …)`): use tokens, or read the value from the DOM.
7. `Toggle.tsx`: make sure Enter or Space does not toggle twice (native button plus keydown). `Popover.tsx:115`: replace `setTimeout(…, 16)` with a frame callback through the motion loop.
8. Honest status: set `PARITY.md` `design-system` back to `wip`. Correct `INTEGRATION.md:82`. In the handoff, replace the false Retry 1 claims with the real state, and add a "Retry 2" section.

Note: the menu motion design is changing in the prototype (playful, with a morphing side submenu and blur). A follow-up task will port it. For now, make the current menus work, compile and look right.
