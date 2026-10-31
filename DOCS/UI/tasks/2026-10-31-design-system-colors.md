# Task: Tailwind setup and the design system page, colors only

**Area:** `foundations` and `design-system` in `DOCS/UI/PARITY.md`, first slice. Set both rows to `wip`.
**Goal:** the user opens `/design-system` and sees the three approved colors.

## Build

1. **Tailwind setup** (the packages are installed, the setup files were removed):
   - `src/editor/styles/tokens.css`: `--ll-` tokens for exactly the three colors in `DOCS/UI/PALETTE.md`: `--ll-neutral-400` `#8F8F8F`, `--ll-neutral-200` `#C4C4C4`, `--ll-neutral-100` `#DFDFDF`. No other colors.
   - `src/editor/styles/tailwind.css`: Tailwind v4 with the `ll` prefix, no Preflight, and an `@theme` block that exposes only those colors (default Tailwind colors disabled with `--color-*: initial`). Read the Tailwind v4 prefix and theme docs in `node_modules/tailwindcss` first.
   - Import `tailwind.css` from `src/editor/styles/globals.css`.
2. **Route** `src/app/design-system/page.tsx` renders the page from `src/editor/design-system/`. It answers 404 unless `labsEnabled` (import it from `src/app/editor/labsEnabled.ts`).
3. **Page** `src/editor/design-system/DesignSystemPage.tsx`, Foundations section "Colors". Use `ll:` Tailwind classes only.

## Design direction

- The page: the backdrop color (`neutral-400`) fills the viewport. On it sits one app frame: rectangular, modest radius token, hairline border, soft shadow. Inside the frame, left to right: a narrow rail and a panel in `neutral-200`, then a large canvas area in `neutral-100`. This shows the colors in the real arrangement.
- Below the frame, a "Colors" section: three swatches in a row (stacked on mobile). Each swatch is a rectangle with a modest radius, the color fill, and under it the role name, token name and hex. No pills, no glass.
- The palette has no text colors yet. Use `#000000` for all text and nothing else. Log that in `DECISIONS.md` as chosen by the worker.
- Spacing on a 4px grid with tokens. One heading, one section label. Restraint: no decoration.
- Non-color tokens (spacing, radius, shadow, border width) are allowed. Build the hairline border from the existing colors, no new colors.
- Nothing is interactive yet, so no focus styles are needed on this slice.

## Files you may touch
`src/app/design-system/**`, `src/editor/design-system/**`, `src/editor/styles/**`, and the `DOCS/UI/**` entries this task requires.
Off limits: everything listed in `UI_RULES.md` §4.

## Done
Screenshots at 1440, 1024 and 390 in `DOCS/UI/handoffs/screenshots/design-system-colors/` (Playwright, headless). Handoff written, and `INTEGRATION.md`, `DECISIONS.md` and `PARITY.md` updated. Do not run the full checks. No commit.

## Retry 1: fix these (watcher verdict: fail)

Do not touch `EditorShell.tsx`, `ProjectHub.tsx`, `animations.css` or the removed `DECISIONS.md` rows. The user asked for those to be cleared, and `DECISIONS.md` records it. Mention them in the handoff as "blanked by the user's request, not by this task".

1. In `globals.css`, replace the raw `#000000` and the global `html, body` rule. Add a `--ll-text` token for `#000000` in `tokens.css` and put the text color on the design system page container, not on `html, body`.
2. Make the `--ll-shadow-soft` color a token too (a `--ll-shadow-color` using black at low alpha) and log it in `DECISIONS.md` as chosen by the worker.
3. Map `--ll-border-hairline` into `@theme` and use it for borders, or remove it. No dead tokens.
4. Extract `Swatch` and `WorkspaceFrame` into `src/editor/components/` and use them on the page.
5. Make the backdrop swatch visible: put the three swatches inside a `neutral-100` panel so the backdrop swatch stands out from the page.
6. Update the handoff with every file touched. Do not create `worker.log` inside the repo. Redirect the log to the scratchpad instead.

## Slice 2: the page becomes a canvas with a right panel, and Geist (user direction)

Do this together with Retry 1. The user wants to judge the design by feeling the canvas, so the design system page is laid out like the editor.

**Fonts (chosen by the user):** Geist for the interface and Geist Mono for code, hex values and numbers. Load both in `src/app/layout.tsx` with `next/font/google` (Geist, Geist_Mono), replacing Inter and JetBrains Mono for the new UI only. Add `--ll-font-sans` and `--ll-font-mono` tokens, map them in `@theme`, and remove the default font utilities. If the legacy styles still reference `--font-inter`, keep both variables loaded so nothing breaks.

**Type scale:** define a scale as `--ll-` tokens and show it on the page: display (large, bold, tight tracking), title, body, small, and a micro label (uppercase, tracked). Use these tokens everywhere, not the Tailwind defaults.

**Layout of `/design-system`** (full viewport, no page scroll, one grid):
- The whole page is the app on the `neutral-400` backdrop, with a 16px inset around it. The app is one rectangle with a modest radius, a hairline border and a soft shadow.
- **Canvas (left, takes the remaining width):** `neutral-100`. It shows the selected item, centered, with generous padding. Foundations (Colors, Type scale, Spacing, Radii, Shadows) and components all render here, and every state of a component is laid out in a labelled row.
- **Right panel (fixed 320px, `neutral-200`):** a hairline divider on its left edge. At the top a small uppercase label "Design system". Below it, a list of items grouped under hairline-divided section labels: **Foundations** (Colors, Type, Spacing, Radii, Shadows) and **Components** (empty until components exist, show a quiet "No components yet" line). Each row is a rectangle with a modest radius, title in body size, large click target (44px tall). The selected row is black with white text. Hover is a slightly darker panel color using only existing tokens, with a visible focus ring. Selecting a row swaps the canvas content (state in the URL hash so it can be linked and reloaded).
- **Tablet and mobile:** the right panel becomes a bottom sheet area above the canvas, stacked, still full width, no horizontal scroll. Keep rectangles, no pills.
- **Keyboard:** the list is a proper list with arrow-key movement and `Enter` to select, with semantic markup (`nav`, `button`, `aria-current`).
- **Motion:** none beyond a 120ms opacity transition on the canvas content swap, with `prefers-reduced-motion` respected.
- **No pills, no frosted glass, no texture** in this slice. Hairline dividers between sections, as in the user's reference.

**Done for this slice:** screenshots at 1440, 1024 and 390 for Colors and Type selected. Log Geist as decided by the user in `DECISIONS.md`.

## Speed rules (the user wants this finished fast)

- Write all the files first, in one pass. Do not stop to verify after each step.
- Do not run `npm run typecheck`, `lint`, `build` or `test:e2e`. Run no checks except the single screenshot pass below.
- One Playwright run at the end: start the dev server once, take the screenshots at 1440, 1024 and 390 for Colors and Type in a single script, stop the server. Retry a screenshot only if the page failed to render.
- Do not re-read files you just wrote. Write the handoff last, in one go.

## Slice 3: the full palette (user approved, run after Slice 2)

`DOCS/UI/PALETTE.md` now has eight colors. Add them all.
- `tokens.css`: tokens for `--ll-neutral-0`, `-50`, `-100`, `-200`, `-400`, `-800`, `-1000` and `--ll-border-color`. Replace the earlier `--ll-text` with `--ll-neutral-1000`. Map all of them in `@theme`, and use the border token for the hairline.
- Colors page on the canvas: group the swatches as Surfaces (backdrop, canvas, panels, toolbar, raised), Text (secondary, primary) and Lines (border). Each shows role, token and hex, and the text swatches show a sample line on the surface they belong on.
- Update the workspace frame to show the real layers: toolbar `neutral-50` on top, rail and panel `neutral-200`, canvas `neutral-100`, one raised white card on the canvas, and one black active control.
- Rectangles only, no pills, no glass. Same speed rules.

## Slice 3 fixes from Claude's review of Slice 2 (do these in the same run)

- Canvas content must be centered in the canvas, as Slice 2 said. At 1440 it sits left of center.
- Drop the nested boxes in the Type page: one hairline-divided list of type samples, not a box inside a box around every sample. The same applies to every foundation page.
- "No components yet" must pass 4.5:1. Use `neutral-800` (`#464646`).
- Check that Geist actually renders: `ll:font-sans` must resolve to `--font-geist-sans`. The 1440 screenshot looks like Inter. Fix it if it falls back.
- The app frame needs the 8px radius and hairline border visible on the backdrop.

## Retry 2: fix these (watcher verdict: fail). Same speed rules.

1. **Geist Mono does not render.** Token and hex labels show a Courier-style fallback. A legacy rule overrides `ll:font-mono`. Find it and fix it so the mono labels render Geist Mono. Check the real computed `font-family` in Playwright, not by eye.
2. **Legacy `h2` styles leak in.** The Surfaces, Text and Lines headings render as boxed bars. Reset `border`, `padding`, `background`, `margin` and `text-transform` where needed, scoped to the design system container only, or use a non-heading element with a proper `role`. Group labels must be plain micro labels with a hairline above (see the user's Agent mode reference).
3. **Mobile at 390:** the raised card in `WorkspaceFrame` is clipped. Make it fluid (`max-w` to the container, no fixed `ll:w-64`) and check there is no horizontal overflow.
4. **Inline `style`** with `px * 4` width in `DesignSystemPage.tsx` is a hardcoded size. Use spacing tokens or `ll:` classes, and make the label match the real size.
5. **Animation:** remove `ll:transition-colors`. Only `opacity` and `transform` may animate. The hover state changes instantly.
6. **No repeated values in `tailwind.css`:** reference `var(--ll-...)` instead of rewriting hex and rgba values. Define `--ll-shadow-*`, canvas width and border color once in `tokens.css`. If `prefix(ll)` makes a reference circular, say so in `DECISIONS.md`.
7. **Decision records:** the rows "Flat foundation lists" and "Implement all eight palette colors" are not the user's. Set them to `Claude` (direction) or `worker (Antigravity)`.
8. **Dead classes:** remove `ll:duration-swap` unless mapped, and check that `ll:max-w-canvas` actually generates. Tailwind v4 `max-w` reads `--container-*`.
9. **Focus ring:** use `neutral-1000` so it passes 3:1 on panels.
10. Remove the two empty white rectangles at the right of the preview toolbar, or make them real labelled controls.
11. Add Swatch and WorkspaceFrame to the Components list in the right panel with their titles, so each one shows on the canvas.
