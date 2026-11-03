# Task: close out the design system page (`design-system`, queue item 5)

- **Given by:** Claude (build session), 2026-11-04, after the user's review: "we have to complete the design page first".
- **Goal:** `/design-system` shows **every component the editor uses, with all its states**, and every component looks like the prototype. Right now the page lists 34 entries, but most of what was built in the last two days is not on it, and nobody has compared the existing entries with the prototype.
- **Files you may touch:** `src/editor/design-system/**`, `src/editor/components/**` (fix looks to match the prototype; keep every export name and prop), `src/editor/styles/{tokens,tailwind,animations}.css` (you are the **only** worker allowed to edit these and `DesignSystemPage.tsx` / `ComponentDemos.tsx` in this batch), `src/app/design-system/page.tsx`. Menu, Popover, Select, CommandPalette, ListRow and `src/editor/motion/*` are read-only: if one looks wrong, say so in the handoff.

## Part 1: compare what is on the page with the prototype

Open `DOCS/UI/design/editor-design-mode-blocks-dark.html` and the other design references in `DOCS/UI/design/` (`topbar-dark.html`, `right-panel-concepts.html`, `logo-options.html`, `menu-motion-variants.html`; read `slider-variants.html` too, but the user has not picked a slider yet, so do not build one) in headless Playwright (`chromium-1248` under `%LOCALAPPDATA%\ms-playwright`, `pathToFileURL`, viewport 1440x900). For every entry already on `/design-system` (Button, IconButton, SegmentedControl, Toggle, Checkbox, Tooltip, TextField, NumberField, Select, ColorSwatchField, Menu, ContextMenu, Popover, CommandPalette, PanelSection, PropertyRow, ListRow, TreeRow, Tabs, Avatar & Ship, EmptyState, TopBar, ThemeToggle, Swatch, WorkspaceFrame, Cursor, Scroll Fade) screenshot the page and the matching prototype element, **write the list of visual differences** (size, padding, radius, type, color, icon, hover, focus, active, disabled) and fix every one in the component. Reference captures of the prototype are in `DOCS/UI/handoffs/screenshots/parity/`.

## Part 2: add what is missing

Add a section, with all states and variants and a working control panel like the existing ones, for each of these (they exist in the app but not on the page). Read each source file for its props:

- Top bar parts: `LogoMark` (idle, saving trace, reduced motion), `ModeTabs`, `PageSwitcher` (closed, open, search, disabled), `ShipPopover` (ready, with issues), `AvatarStack` (with the `+N` chip, empty).
- Canvas chrome (`src/editor/shell/canvas-chrome/`): `Toolbar` (every tool state, shape menu open, zoom menu open), `InsertBox`, `AiBox` (idle, working with the trace loader, done), `ViewOptionsPopover`, `Rulers`, zoom bar.
- Layer menu (`src/editor/shell/left-panel/LayerContextMenu.tsx`), the left panel rows (layer row, file row, track row, asset tile), `LeftPanelHeader`, `LeftPanelEmpty`.
- Right panel (`src/editor/shell/right-panel/`): section header with its "…" and "+" buttons, accordion row, AI chat, `RightPanelEmptyPlaceholder`.
- Inspector controls (`src/editor/panels/details/controls/`): `AlignBar`, `AlignmentGrid`, `EasingCurveBox`, `RepeatableRow`, `RowSettingsPopover`, and the field kinds used by the sections (number scrub, color field, x1 y1 x2 y2 box).
- Stage (`src/editor/stage/`): selection outline, the 8 handles, hover outline, size chip.
- Timeline (`src/editor/panels/timeline/`): transport, ruler, lane, playhead, keyframe diamond, curve graph. Code panel (`src/editor/panels/code-view/`): code view with line numbers, console view.

Each demo uses sample props only (never a store). If a part cannot render alone, render it inside a small frame like `WorkspaceFrame`.

## Part 3: foundations and navigation

- The sidebar groups: Foundations, Components, and new groups for Shell, Canvas, Panels and Motion so the page stays navigable. Keep the search or anchor links working.
- Foundations: confirm Colors lists the five official themes only; add the sizes tokens the shell uses (panel widths, top bar height, bottom panel heights, row heights) to Layout Sizes if missing.
- Wishes from earlier handoffs that are cheap and belong to the page (a `--ll-dur-trace` of 2.4 s for the AI loader next to the 1.6 s logo trace, a named stroke width for the loader) can be added to the tokens; list each in the handoff.

## Rules that matter here

Tailwind `ll:` prefix, variant order `ll:hover:`; tokens only (no arbitrary values, hex, px or ms literals); React never owns classes or styles motion code writes; no `setState` in effects; no raw `requestAnimationFrame`; `ll-` prefix on globals, `useId()` for ids; icons through `Icon`; no glass, blur, pills or translucent surfaces; honour `prefers-reduced-motion`; visible focus rings; colors only from `DOCS/UI/PALETTE.md` through semantic tokens. The page route stays guarded by `labsEnabled`.

## Parallel batch rules

- Other workers may be running on other files at the same time. Edit only the files listed above. Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- The dev server is already running on http://localhost:3000. Never start `next dev` or `next build`.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`; put notes in the handoff.
- `src/legacy-editor/**`, `src/core/**`, `src/compiler/**`, `src/runtime/**`, `src/ai/**` are read-only.

## Done

`npx tsc --noEmit` once at the end (real output in the handoff), screenshots at 1440 of every new section and a before and after for each component you changed, and the handoff `DOCS/UI/handoffs/2026-11-04-<time>-design-system-closeout.md` from `TEMPLATE.md`: the difference list per component with fixed / not fixed, the sections you added, token additions, and "Not done / blocked". Be honest about what you did not verify. Do not commit or push.
