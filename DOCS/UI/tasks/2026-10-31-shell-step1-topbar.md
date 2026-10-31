# Task: shell step 1, the top bar

**Area:** `shell` in `DOCS/UI/PARITY.md`, step 1 of 5. Set the row to `wip`. Replace the bridge `src/editor/shell/EditorShell.tsx` (it is a blank `<main />` now) and keep its export name `EditorShell` and the way `src/app/editor/page.tsx` uses it.
**Goal:** `/editor` shows a full-viewport page with a top bar and one empty canvas area. Nothing else.

## Layout (user direction: no app frame, no inset, no outer radius)
- The page fills the viewport, no page scroll. Column: top bar (fixed 48px high) over one area `neutral-100` (`#DFDFDF`) that takes the rest. That area is the future canvas and stays empty.
- Top bar: `neutral-50` (`#F1F1F1`), hairline bottom border. Three groups: left, center, right, on a 4px grid with 12px side padding and 8px gaps. Center group is truly centered on the bar.
  - **Left:** a small square logo mark (a black rounded-rectangle, 24px, radius 6px, with a white "L" in Geist bold: no image assets), the text "Lazy Layout" (title size, semibold), then a hairline vertical divider, then the project name as a quiet text button (secondary text color, `neutral-800`).
  - **Center:** segmented control Desktop / Tablet / Mobile, each option an icon (lucide, 16px, 1.5 stroke) and a label from `sm` up, icon only below `sm`.
  - **Right:** icon buttons Undo, Redo, Search (all secondary icon buttons, 32px square), a hairline divider, then **Share** as the one primary black button with white text, then a Settings icon button.
- Below `sm` (390 wide): hide the project name and the labels, keep logo mark, segmented control, Share and a Settings button. Nothing may overflow. Targets stay at least 32px.

## New components (all in `src/editor/components/`, each on the design system page under Components with every state)
1. **Button**: variants `primary` (black, white text), `secondary` (white `neutral-0`, hairline border, black text), `ghost` (transparent, for icon buttons); sizes `sm` (28px) and `md` (32px); icon-only shape is square with 6px radius; states default, hover, focus-visible (2px ring `neutral-1000`, offset 2px), active, disabled, loading (a simple 1.5px stroke spinner using `transform` only, reduced motion respected).
2. **SegmentedControl**: a joined group of rectangles in one hairline-bordered container, 6px radius, inner options radius 4px (concentric), active option black with white text, arrow-key navigation, `role="radiogroup"` with `aria-checked`.
3. **Tooltip**: small black rectangle, white micro text, 4px radius, shows on hover and keyboard focus after 300ms, opacity only, positioned above the target, no glass or blur.
4. **TopBar**: assembles the above for the shell. Also shown on the design system page as a static preview at the three widths.

Rules: rectangles only, no pills, no glass, no new colors, only `ll:` tokens (add any new non-color tokens such as `--ll-size-control-sm` to `tokens.css`). Icons from `lucide-react` only. Hover is an instant color change on `neutral-100`, no color transitions.

## Behaviour
Read `src/legacy-editor/shell/StudioHeader.tsx`, `MainToolbar.tsx`, `TransportBar.tsx` and the stores they use. Wire these through imports from `@/legacy-editor`, non-visual logic only: the device switch (Desktop/Tablet/Mobile), undo and redo (disabled when nothing to undo), the project name, and search opening the existing command palette if a store or command exists. Share and Settings do nothing yet; disable-free, no dead handlers: render them as buttons without an onClick and log "not wired" in the handoff. List in `INTEGRATION.md` every store and hook you rely on.

## Files you may touch
`src/editor/**`, `src/app/editor/page.tsx` only if the import needs it, and the `DOCS/UI/**` entries this task requires. Off limits: everything listed in `UI_RULES.md` §4.

## Done
Screenshots of `/editor` at 1440, 1024 and 390 in `DOCS/UI/handoffs/screenshots/shell-step1/`, and of the new components on `/design-system`. Handoff, `INTEGRATION.md`, `DECISIONS.md`, `COMPONENT_SOURCES.md` (only if you copied a component from another site), `PARITY.md` updated. Do not run typecheck, lint, build or e2e. Write all the files first, one Playwright pass at the end (use the installed Chrome with `channel: "chrome"` because the bundled browser is missing; stop the dev server afterwards), do not re-read files you just wrote, write the handoff last. No commit.
