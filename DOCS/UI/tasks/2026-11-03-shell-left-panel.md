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

## Retry 1: review failed (2026-11-03)

The structure is right: modes, search keeps ancestors, the separator has `role="separator"` and keyboard resize, data comes through props. Fix these. Edit only the files you were allowed (`src/editor/shell/left-panel/**`, `src/app/design-system/left-panel/page.tsx`). `TreeRow.tsx` is read-only: for anything that needs a change there, log it in the handoff under "Not done / blocked".

1. **Wrap the lab in `.editor-root`** (`LeftPanelLab.tsx:49,144`). Native buttons currently show browser bevel borders because the reset (`globals.css:10-21`) only applies under `.editor-root`. Then **retake all screenshots** (all six, plus one with a row hovered and one with a selected row showing the hide/lock affordances) and look at them: the 12 px expand chevrons must render as chevrons, not boxed corner glyphs. If they still look wrong, say so in the handoff.
2. **No `setState` in an effect.** `LayersTree.tsx:199-201` and `FilesTree.tsx:156-158` call `onMatchCountChange` from `useEffect`. Compute the filter with one shared pure function (used by `LeftPanel` and the trees) and derive the count during render. Remove `onMatchCountChange`. The count must not read "0 layers" for a frame before it updates.
3. **`aria-activedescendant` is dead** (`LayersTree.tsx:283-292`, `FilesTree.tsx:239-247`): `TreeRow` renders only `data-id`, no DOM `id`. Move focus into the tree with a roving `tabindex` on the rows, or drop the attribute and log the `TreeRow` limitation in the handoff.
4. **Tracks roles** (`TracksList.tsx:35-41`): `role="treeitem"` without a `role="tree"` parent is invalid. Use `role="listbox"` with `role="option"`. The rows need a visible focus ring (remove `ll:outline-none` without a replacement).
5. **No literals.** Use tokens or one named constants file in `src/editor/shell/left-panel/`: `"36px"` (`AssetsSection.tsx:149`); the 80, 160, 400, 0.6 and the 10 px keyboard step (`:64,69,90,97,135-137`); the default `200` (`AssetsSection.tsx:57`, `LeftPanel.tsx:57`); `"var(--bh, 260px)"` (`TracksList.tsx:17`; `--bh` is not a `--ll-` token, use `--ll-size-*` and list the wish); the heights 900, 260 and 200 in `LeftPanelLab.tsx:146,226,250`. `aria-valuemax` must equal the real maximum (`parent height * ratio`), computed.
6. **Durations:** `ll:duration-120` (`AssetsSection.tsx:164`) does not exist. Use `ll:duration-swap` or `ll:duration-fade`. (`TreeRow.tsx:132` has the same bug: log it in the handoff for the build session.) Add `ll:motion-reduce:transition-none` to the chevron (`:162-166`) and the asset hover (`:228`) transitions.
7. **Reuse the design system:** the search field (`LeftPanelHeader.tsx:91-119`) uses `TextField`, and the empty states (`LayersTree.tsx:316-322`, `FilesTree.tsx:267-273`) use `EmptyState`. Move `AssetTile` into `src/editor/shell/left-panel/` as a documented exception only if no component fits, and log it in the handoff. Replace the raw `<img>` (`AssetsSection.tsx:109`) with one wrapper in the same folder that sets `alt`, `loading="lazy"` and `decoding="async"`.
8. **Pointer drag** (`AssetsSection.tsx:55-86`): use `onPointerDown`, `onPointerMove` and `onPointerUp` props with `setPointerCapture`, not manual listeners, so unmount mid-drag leaks nothing.
9. **Header layout** (`AssetsSection.tsx:171`): one flex row with the action buttons inside it, not an `absolute` overlay. The row height uses the same token as the header.
10. **Default Tailwind scale values** (`LeftPanelLab.tsx:49,189-194,201`: `ll:ml-24`, `ll:w-48`, `ll:max-w-2xl`, `ll:h-96`, `ll:tracking-wider`): replace with tokens or simplify the mock stage.
11. Move the pre-seeded expanded ids and sample state (`LeftPanel.tsx:44-52`) out of the production component into `sampleData` or the lab. Share the arrow-key logic between `LayersTree` and `FilesTree` as one hook.
12. Update the handoff with a "Retry 1" section: the real `npx tsc --noEmit` output, the new screenshots, the design decisions (for example, the "Layers" title fallback in Design mode is a worker choice) and everything under "Not done / blocked".
