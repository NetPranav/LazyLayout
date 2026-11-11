# Handoff: Pages manager and Sections (now in the Insert box)

> **Update, same day:** the separate Sections toolbar button and the slide-in gallery were a mistake (they duplicated the Insert box) and were removed. The Sections category of the toolbar `+` Insert box now shows the section cards (live thumbnails, two columns, name under each, hover lift with an `Insert` label); the box's search also finds sections. A click inserts below the selected block and closes the box, like the box's other items. Files now: `shell/canvas-chrome/{SectionThumb.tsx,insertSection.ts,sectionCategories.ts}` and `InsertBox.tsx`; `shell/sections-gallery/` is deleted, and `LeftPanelConnected` and `Toolbar` no longer use `useTemplatesUiStore`. The Sections notes below describe the old panel; the thumbnails, insertion and undo behave as described. Screenshots: `screenshots/insert-sections/`.

- **Date / time:** 2026-11-11
- **Worker:** Claude subagent
- **Branch:** ui/redesign
- **Page / phase:** Design page, left panel (Pages manager) and floating toolbar (Sections gallery)
- **Task given by:** the orchestrating session (no task file)

## What changed
- `src/editor/shell/pages-manager/` (new): `PagesManager.tsx` (the left-panel header's `Home ⌄` button and the Pages popover), `PageRow.tsx` (row: name, route, current marker, hover "more" button, inline rename, inline delete confirm), `PageSettingsPopover.tsx` (title, route, search description, share image), `useRowDrag.ts` (drag to reorder with a thin insertion line on the shared spring), `layerGuard.ts`, `pagesModel.ts` (every page operation), `index.ts`.
- `src/editor/shell/sections-gallery/` (new): `SectionsGallery.tsx` (panel), `SectionThumb.tsx` (live scaled drawing of a template), `sectionCategories.ts`, `insertSection.ts`, `index.ts`.
- `src/editor/panels/layers/LeftPanelConnected.tsx`: mounts `PagesManager` in place of the old `PageSelector`, passes it the layer search text, wraps the panel in a relative box and mounts `SectionsGallery` over it (Design mode only). `usePagesData` is no longer used there (still used by `LayersLab`; `PageSelector` stays for the design system demo).
- `src/editor/shell/canvas-chrome/Toolbar.tsx`: one new button, "Sections" (lucide `LayoutPanelTop`), after Insert. It toggles the engine's own `useTemplatesUiStore`, so no props were added to `CanvasChrome` or `EditorShell`.

## How it works
**Pages.** Click `Home ⌄` to open the list: one line per page (name, route in a lighter mono tone), the current page has a 2px marker and the selection tint as in Layers. Header: count and a small round `+`. Click a row to switch the canvas to that page (the popover closes after a moment, so a double click can still start a rename). Double click, F2 or Rename: in place; Enter or blur commits, Esc cancels. Right click or the hover `⋯` button: Rename, Duplicate, Set as home, Settings…, Delete. Delete swaps the row to `Delete "About"?  [Delete] [Cancel]` (no modal; the last page cannot be deleted). Drag a row: it follows the pointer, a hairline shows where it lands. Settings… opens a second popover beside the row. Empty state `No pages yet` + Add page is in the code but cannot be reached (a project always has a page). The header search icon still filters layers; if it has text, the Pages list shows only matching pages (name or route), and the trigger gets a small dot.

**Engine.** Pages are `PageDefinition`s in `useProjectStore` (what the stage and export read). The engine's multi-page actions (`addPage` etc.) live in `src/after/store/pagesActions.ts`, which `scripts/check-bundle-scope.mts` forbids in the initial edition's bundle, so I did not import it. `pagesModel.ts` records one history step per operation with the engine's `recordProjectChange` (with `includesDocument` when layers change) and then writes the store: one Ctrl+Z undoes one operation. Add creates a 1440x900 root frame; Duplicate deep-copies the page's layers and clips (`cloneLayers`), which the engine's own `duplicatePage` does not (it copies only the root); Delete removes the page's layers too; Rename also renames the root frame when it still carries the page's name; Set as home swaps `/` with the old home, which gets `/<name>`.

**Sections.** The engine already has eight section templates and `insertSection` (`src/core/templates`), so I did not write `sectionTemplates.ts`. The card thumbnails are drawn from `template.build(copy)` at 1280px wide and scaled with CSS (no images), so they cannot drift from what is inserted. Insert goes through `insertSection` inside one `transaction`, below the selected block of the current page (else the engine's default: end of the page, above the footer; Navbar goes first, Footer last). The panel stays open; the new section fades and rises in with a spring. Esc or the toolbar button closes it. Tabs are the categories that have templates: Hero (Hero, CTA), Content (Features, Testimonials, FAQ), Pricing, Navigation (Navbar, Footer); a search field filters by name.

## Decisions made
- Used the project-store page model, not the Phase 48 "frame with `page.route`" model (`core/pages/pageOps.ts`, commands `page.create` etc.): the stage, export and the existing left panel all read `useProjectStore.pages`, and the two models are not synced.
- Page operations live in the editor with `recordProjectChange` instead of importing the after-track module (bundle-scope rule above).
- Row actions open the existing `Menu` (context variant); settings open an existing `Popover` in a different overlay family so they stay open beside the list.
- Gallery covers the whole left panel (it has its own header and close button).

## Components from other sites
none

## Legacy behaviour dropped
- The old selector's search box inside the popover, flyout and sliding highlight band; the search icon in the header now covers it.
- Per-page guards, dynamic parameters, redirect rules and 404 flag of the legacy Pages & Routing manager (not asked for here).
- Starter projects of the legacy gallery (`project.addStarter`): only sections are in the new gallery.

## Tokens / palette touched
none (existing tokens and components only; no new CSS).

## Integration notes added
- "Pages manager and Sections gallery" in `INTEGRATION.md` (engine changes requested).

## Not done / blocked
- **Share image** for a page: no field in `PageDefinition`; the row is shown disabled ("Not supported by the engine yet"). Requested in INTEGRATION.md.
- **Drag a card onto the canvas**: not built (insertion is by click, below the selection or at the end). Needs a drop target on the stage and a position-to-index mapping.
- **390 px**: the shell hides the left panel there and the panels toggle does not bring it back in my run, so neither feature can be reached or screenshotted at 390 (`screenshots/pages-sections/pages-sections-390-left-panel-unreachable.png`, and `sections-04-390.png` for the toolbar, which already overflowed and is a little wider now).
- The initial edition is single-page by design (`pagesActions` is full-edition only); this manager now works in both. Decide if the initial edition should hide it.
- Description/title are saved as `metaDescription`/`metaTitle`; the export reads them only where the compiler already does (not checked).
- Not checked in a browser: the empty state, a route typed that collides (error text) and the home-route guard messages (code only), Delete of a page that shares a root with another (code only).

## Phase checks
- typecheck: `npx tsc --noEmit` passed (0 errors).
- lint: `npx eslint src/editor` 0 errors (82 warnings, none in the new folders).
- build: not run (as instructed).

## Checked in a browser (headless Chromium, 1440x900, one browser at a time)
Add (x2), rename by double click, undo of rename, duplicate (page and canvas show the copied layers, undo removes the frame), set as home (routes swap), settings (title, route normalised to `/team-page`, description), reorder by drag and its undo, inline delete confirm, delete and undo, switch page, layer search still counts matches. Gallery: open from toolbar, filter by tab, search, insert Hero then Features (below the selection, panel stays open), Esc closes, toolbar button toggles, two Ctrl+Z remove both sections. Reduced motion emulated: gallery opens and closes. Screenshots in `DOCS/UI/handoffs/screenshots/pages-sections/`.
