# Task: rebuild the left panel (`shell`, Phase 1, queue item 2)

- **Given by:** Claude (build session), 2026-11-03. **Area:** `shell`: left panel.
- **Goal:** a `LeftPanel` component that looks and behaves exactly like the prototype's left zone, for all three modes (Design: Layers + Assets; Motion: Layers + Tracks; Code: Files). The build session mounts it into the shell later; you build the component and its lab route.

## Read only these

- **Prototype:** `DOCS/UI/design/editor-design-mode-blocks-dark.html`
  - CSS: `/* ===== PANELS ===== */` (~214-263), plus the `.zone`, `.zhead`, `.lsbox`, `.lsfield`, `.lscount`, `.lsplit`, `.lassets`, `.trow`, `.tracks`, `.row` rules (grep these selectors in lines 56-670).
  - Markup: `<aside class="zone left">` (~819-873): `#lhead`, `#lsearchbtn`, `#lfilter`, `#p-layers`, `#p-files`, `#p-tracks`, `#lsplit`, `#p-assets`. The `#pagebtn` page switcher is built by the top bar worker as `PageSwitcher`; **leave a `headerStart` slot** for it.
  - Script: layer tree rendering and expand/collapse, `lsFilter`, the search toggle, the assets split drag, and the left-panel part of `setMode` (~2698-2720).
- **App:** `src/editor/components/{TreeRow,ListRow,TextField,IconButton,PanelSection,EmptyState,Icon}.tsx` (reuse), `src/editor/styles/tokens.css`.
- **Legacy reference** (read only, for types and non-visual logic): `src/legacy-editor/panels/layers`, `src/legacy-editor/panels/assets`.

## Behaviour to port (copy values, do not tune)

1. Header (`.zhead`): the `headerStart` slot, the section title (Layers or Files; hidden in Design mode where the page switcher shows), a search icon button (`aria-pressed`) that reveals the filter box with a clear button and a result count.
2. **Layers tree:** `role="tree"`, rows with expand chevrons, type icons, hide/lock affordances as in the prototype, selection and hover states, arrow-key navigation. Search filters rows and keeps the ancestors of matches.
3. **Files** (Code mode), **Tracks** (Motion mode, `.trow` 32 px), **Assets** (Design mode, bottom section with the draggable `#lsplit` separator, `role="separator"`, keyboard resizable). What shows depends on a `mode` prop (`design | motion | code`).
4. Data comes through props (`layers`, `files`, `tracks`, `assets`, `selectedIds`, `onSelect` and similar). Use sample data in the lab route. Do not wire stores in this task.
5. Sizes, paddings, row heights, fonts and borders from the prototype via existing `--ll-*` tokens.

## Rules that matter here

Variant order `ll:hover:`; no arbitrary values or hex; no px/ms literals; React never owns classes or styles motion code writes (use data attributes); no browser-only reads on first render; no raw `requestAnimationFrame`; no `setState` in effects; `ll-` prefix on globals; `useId()` for ids; every icon via `Icon`; native non-passive wheel listeners; no glass, blur or pills.

## Files you may touch

New files under `src/editor/shell/left-panel/**` (export `LeftPanel` from `src/editor/shell/left-panel/index.ts`) and `src/app/design-system/left-panel/page.tsx`. Nothing else.

## Done

`npx tsc --noEmit` once, screenshots at 1440 for each mode and with the search open, and the handoff. Do not commit.

## Parallel batch rules (4 workers run at once in the same working tree)

- Other workers are editing other files right now. **Edit only the files listed under "Files you may touch".** Never run `git add`, `git commit`, `git stash`, `git checkout` or `git reset`.
- `npx tsc --noEmit` covers the whole project, so errors in other workers' files may appear. Fix only errors in your own files and note the rest in the handoff.
- **The dev server is already running on http://localhost:3000. Do not start `next dev` or `next build`.** Playwright: headless only, `executablePath` of the `chromium-1248` build under `%LOCALAPPDATA%\ms-playwright` (the default 1243 is not installed). Use your own screenshot folder.
- Do not edit `DECISIONS.md`, `PARITY.md`, `INTEGRATION.md`, `COMPONENT_SOURCES.md`. Put decisions, integration notes, component sources and token wishes in your handoff and the build session merges them.
- `Menu.tsx`, `Popover.tsx`, `Select.tsx`, `CommandPalette.tsx`, `ListRow.tsx`, `src/editor/motion/*` are read-only for you (another session has uncommitted work there). Need a change? Put it in the handoff under "Not done / blocked".
- Shared files (`tokens.css`, `tailwind.css`, `animations.css`, `ComponentDemos.tsx`, `DesignSystemPage.tsx`, `EditorShell.tsx`, `components/index.ts`) belong to the **top bar worker** only unless your list says otherwise. Use only existing tokens. If you need a new token, use the closest existing one and list the wish in the handoff.
- Verify your component without the shell: add a lab route `src/app/design-system/<your-area>/page.tsx` (copy the `labsEnabled` / `notFound()` guard from `src/app/design-system/page.tsx`) that renders your component inside a 1440 x 900 frame. Screenshots at 1440 only, in `DOCS/UI/handoffs/screenshots/<your-area>/`.
- Write the handoff as `DOCS/UI/handoffs/2026-11-03-HHMM-<your-area>.md` from `TEMPLATE.md`. **Do not commit.**
