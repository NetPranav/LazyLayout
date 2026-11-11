# Integration Notes (for A and B)

When the rebuild is done, Lane A and Lane B use this file to connect the new UI to the project. **Workers: add entries as you work.** Keep them short. Use this shape under the matching section:

```
### <short title>
- **Area:**
- **Files:**
- **What changed:**
- **What A/B must do:**
- **Status:** open | done
```

## 1. Replaced or removed UI

### Replaced EditorShell bridge with real TopBar shell
- **Area:** shell
- **Files:** `src/editor/shell/EditorShell.tsx`
- **What changed:** Replaced the empty `<main />` bridge with a full-viewport layout containing the fixed 48px `TopBar` and an empty `neutral-100` canvas area.
- **What A/B must do:** Keep `EditorShell` exported from `src/editor/shell/EditorShell.tsx`.
- **Status:** open

### Old editor moved to `src/legacy-editor`
- **Area:** rebuild setup
- **Files:** `src/legacy-editor/**`, bridge files in `src/editor/**`, `eslint.config.mjs`
- **What changed:** The old editor moved, with its internal imports changed to `@/legacy-editor/...`. Routes, `src/app/layout.tsx`, `src/compiler/export/CrossFrameworkExporter.ts` and the `src/core` tests still import `@/editor/...`, which now resolve to bridges and later to new components.
- **What A/B must do:** Make any old-UI fix in `src/legacy-editor`, and port it if that area is already rebuilt.
- **Status:** open until `src/legacy-editor` is removed

### Legacy editor route `/editor/legacy`
- **Area:** shell / routes
- **Files:** `src/app/editor/legacy/page.tsx`, `src/app/editor/legacy/LegacyStudioHeader.tsx`, `src/legacy-editor/shell/EditorShell.tsx`, `tests/e2e/support/editor.ts`
- **What changed:** Main's editor is retained and served at `/editor/legacy` with all Phase 39-81 features (pen tool, auto layout, breakpoints, tokens, graph editor). Rendered `LegacyStudioHeader` in `headerSlot` to provide the classic menu bar (`File`, `Edit`, `View`, `Window`, `Help`) and `#header-toggle-demo-btn` ("Mount Showcase Demo"), and imported legacy `globals.css` for `--z-header` and `--z-dropdown` stacking context. Configured `openEditor` in `tests/e2e/support/editor.ts` to default to the NEW editor (`EDITOR_URL = "/editor"`), and exported `LEGACY_EDITOR_URL = "/editor/legacy"`. All 29 of main's e2e spec files explicitly target `LEGACY_EDITOR_URL` and pass 100% (138/138 tests).
- **What A/B must do:** Target `LEGACY_EDITOR_URL` (`/editor/legacy`) for old-UI e2e tests; target `EDITOR_URL` (`/editor`) for new-UI specs.
- **Status:** done

### Old UI spec docs removed
- **Area:** docs
- **Files:** `DOCS/INITIAL/UI.md`, `DOCS/INITIAL/PANELS.md`
- **What changed:** Deleted on the user's instruction, because they describe the old UI. They remain in git history. Other docs and `src/ai/copilot/DiagnosticSuggester.ts` still mention them by name.
- **What A/B must do:** Do not restore them on merge.
- **Status:** open

### Root `CLAUDE.md` and `AGENTS.md` kept as `main`'s (changed in the merge review, 2026-11-05)
- **Area:** repo instructions
- **Files:** `CLAUDE.md`, `AGENTS.md`, `DOCS/UI/ORCHESTRATOR_RULES.md` (new), `DOCS/UI/WORKER_RULES.md` (new)
- **What changed:** The PR replaced the root `CLAUDE.md` (which imports `AGENTS.md` and `DOCS/TEAM/COLLABORATION.md`) with the UI rebuild's orchestrator rules, and appended the Antigravity worker rules to `AGENTS.md`. Merged as they were, every Claude in the repo (both lanes) would have read "the two-lane rules do not apply here", "never push at all", "do not commit or push" and "do not edit `src/core`". The root files are `main`'s again, each with a short pointer to the UI rules; the rebuild's rules moved unchanged (plus a scope note) to `DOCS/UI/ORCHESTRATOR_RULES.md` and `DOCS/UI/WORKER_RULES.md`.
- **What the UI sessions must do:** point the workers at `DOCS/UI/WORKER_RULES.md` (they used to get it from `AGENTS.md`). `.claude/agents/ui-orchestrator.md` still says "Read `CLAUDE.md`" and "`CLAUDE.md` §3": read `DOCS/UI/ORCHESTRATOR_RULES.md` instead (that file could not be edited from the review session).
- **Status:** done

## 2. Engine contracts the new UI relies on

### Top bar engine bindings
- **Area:** shell / top bar
- **What the UI uses:** `useProjectMetaStore((s) => s.projectName)` for dynamic project name; `useHistoryStore((s) => s.past.length > 0)` and `future.length > 0` for `canUndo` and `canRedo`; `invokeCommand("frame.focusPreset", { preset })` for viewport switching; `invokeCommand("edit.undo")` and `invokeCommand("edit.redo")` for undo/redo actions; `invokeCommand("view.commandPalette")` and `antigravity:open_command_palette` custom event for global search/command palette opening.
- **Status:** open

### Selection, commands and project store
- **Area:** top bar
- **What the UI uses:** `useSelectionStore((s) => s.selectedIds)`; `invokeCommand` with `align.left`, `align.hcenter`, `align.right`, `align.top`, `align.vcenter`, `align.bottom`, `distribute.horizontal`, `distribute.vertical`, `layer.tidy`, `layer.bringForward`, `layer.sendBackward`, `edit.group`, `edit.undo`, `edit.redo`, `view.commandPalette`; `MENU_MODEL` actions; `useProjectStore` `mountDemoProject` and `clearToBlankCanvas`.
- **Status:** open

### Motion engine frame loop scheduler
- **Area:** motion
- **What the UI uses:** The motion loop (`src/editor/motion/loop.ts`) coordinates its frame execution using the core engine's `frameScheduler` (`src/core/time/scheduler.ts`).
- **Status:** done

### Warp mesh rendering and canvas overlay (TASK G)
- **Area:** engine & stage / inspector
- **Files:** `src/core/geometry/meshWarp.ts`, `src/core/document/properties.ts`, `src/core/render/geometry.ts`, `src/core/render/RenderLayer.tsx`, `src/editor/stage/WarpMeshOverlay.tsx`, `src/editor/panels/details/sections/PositionSection.tsx`
- **What changed:** Added `transform.mesh` property ("cols,rows;x,y;..."), shared renderer tile splitting with projective matrix3d, canvas interactive overlay with handle dragging and row shift-dragging, and inspector controls under Position > More.
- **Status:** done

## 3. Engine changes requested

### Auto layout and grid
- **Area:** stack and grid frames on the canvas and in the Layout section
- **Used (read-only):** `layoutOps` (`setStack`, `setGrid`, `setGridCell`, `addAutoLayout`, `addGridLayout`, `readStack`), `moveLayers`, `useStackDropStore`, `layout.addAuto` (Shift+A) and `layout.removeAuto` (Alt+Shift+A).
- **Engine changes requested (nothing blocks the UI):** (1) a command to remove a grid track (columns and rows can be added and resized, not removed from the canvas); (2) grid drag-reorder moves by child index, so there is no drop into a chosen cell (cell start/span exist, a cell-aware drop does not); (3) a gap strip is not drawn for wrapped stacks because there is no per-line gap read; (4) `setStack` has no "this side only" padding toggle in the doc model, so the canvas writes the four `layout.padding*` props directly inside one transaction.

### Vector Pen tool support in core engine
- **Area:** tools / engine
- **Files:** `src/core/tools/toolDefs.ts`, `src/core/paths/penModel.ts`
- **What changed:** Toolbar and Stage wire Pen tool selection (`P`) and vector path node placement. Core engine tool definitions and vector network commands should be verified and fully activated in tool registry.
- **What A/B must do:** Ensure core tool machine and stage overlays provide full bezier control point dragging and path completion integration.
- **Status:** open

### Pages manager and Sections gallery (2026-11-11)
- **Area:** left panel header, toolbar, `src/editor/shell/pages-manager/`, `src/editor/shell/sections-gallery/`
- **What changed:** `LeftPanelConnected` mounts `PagesManager` (was `PageSelector`) and `SectionsGallery`; the Toolbar has a "Sections" button that toggles `useTemplatesUiStore`. Section insertion calls the engine's `insertSection` in one transaction. Page operations are in `pagesModel.ts` and write `useProjectStore.pages` after `recordProjectChange`, because `src/after/store/pagesActions.ts` may not be imported (bundle-scope check).
- **Engine changes requested:**
  1. **Page operations as commands.** `page.add`, `page.duplicate`, `page.delete`, `page.rename`, `page.setHome`, `page.reorder`, `page.setMeta` on the project-store page model, each one undo step, available in every edition. Today the only commands (`page.create`, `page.setRoute`, `page.setHome` in `core/pages/pageCommands.ts`) act on the other model (a frame with `page.route`), and the project-store actions are full-edition only. The two models are not synced.
  2. **`duplicatePage` copies the whole page.** The after-track `duplicatePage` copies only the root layer (`children: []`); it should clone the subtree and clips (the UI does this itself with `cloneLayers`).
  3. **`deletePage` removes the page's layers** (the after-track one leaves the root frame in the document).
  4. **Share image.** `PageDefinition` has no field for it (`ogImage` or an asset id); the settings popover shows the row disabled.
  5. **Drop a section on the canvas.** `insertSection` only takes a page; it needs an `index` (or `afterId`) option so a drag from the gallery can place it where dropped. The UI now moves the new section after insertion (inside the same transaction).
- **Status:** open

## 4. New shared UI pieces

### ThemeToggle component
- **Area:** components
- **Files:** `src/editor/components/ThemeToggle.tsx`, `src/editor/components/TopBar.tsx`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** Added `ThemeToggle` component (ghost icon button, Lucide Sun/Moon icons, "Switch theme" tooltip). Placed in TopBar right group before Settings and in Design System right panel header. Persists `dark` / `light` state in `localStorage` under key `lazy-layout-theme` and coordinates state across mounts via custom event `ll-theme-change`.
- **What A/B must do:** Reuse `ThemeToggle` in new modal headers or settings surfaces where theme control is needed.
- **Status:** open

### Button, SegmentedControl, Tooltip, and TopBar
- **Area:** components
- **Files:** `src/editor/components/Button.tsx`, `src/editor/components/SegmentedControl.tsx`, `src/editor/components/Tooltip.tsx`, `src/editor/components/TopBar.tsx`, `src/editor/components/index.ts`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** Added `Button` (variants `primary`, `secondary`, `ghost`; sizes `sm`, `md`; icon-only square with 6px radius; loading spinner animating only transform; focus-visible ring `neutral-1000` with 2px offset; instant hover on `neutral-100`), `SegmentedControl` (concentric radii with 6px outer container and 4px inner options; active option black with white text; arrow-key radiogroup navigation), `Tooltip` (solid black rectangle with 4px radius, white micro text, 300ms hover/focus delay, opacity only, positioned above target), and `TopBar` (48px fixed bar, neutral-50 surface, hairline border, truly centered device switcher, responsive hiding of labels/secondary actions below 640px/390px with zero overflow). All added to design system page with full state matrices and 1440/1024/390 static previews.
- **What A/B must do:** Reuse these components across future editor panels.
- **Status:** open

### Design system page and extracted components
- **Area:** design system
- **Files:** `src/editor/components/Swatch.tsx`, `src/editor/components/WorkspaceFrame.tsx`, `src/editor/design-system/DesignSystemPage.tsx`, `src/app/design-system/page.tsx`
- **What changed:** Every new UI component lives in `src/editor/components/` and is shown on `/design-system`. Extracted `Swatch` (supporting surfaces, text samples on target surfaces, and hairline lines) and `WorkspaceFrame` (showing real layers: `neutral-50` toolbar with labelled controls, `neutral-200` rail & panel, `neutral-100` canvas, fluid `neutral-0` raised card, and `neutral-1000` active control; verified fluid and unclipped at 390px mobile). The design system page provides a centered canvas workspace on the left and a fixed 320px right navigation panel (stacked on tablet/mobile) with hash-linked routes. Both foundations (Colors, Type, Spacing, Radii, Shadows) and components (`Swatch`, `WorkspaceFrame`) are accessible via keyboard and listed in the navigation hierarchy.
- **What A/B must do:** Reuse these components, and add or change them on the design system page first.
- **Status:** open

### 21 Core Components built for the new UI
- **Area:** components
- **Files:** `src/editor/components/` (`Button.tsx`, `IconButton.tsx`, `SegmentedControl.tsx`, `Toggle.tsx`, `Checkbox.tsx`, `Tooltip.tsx`, `TextField.tsx`, `NumberField.tsx`, `Select.tsx`, `ColorSwatchField.tsx`, `Menu.tsx`, `ContextMenu.tsx`, `Popover.tsx`, `CommandPalette.tsx`, `PanelSection.tsx`, `PropertyRow.tsx`, `ListRow.tsx`, `TreeRow.tsx`, `Tabs.tsx`, `Avatar.tsx`, `EmptyState.tsx`, `Icon.tsx`, `useMounted.ts`, `index.ts`), `src/editor/design-system/demos/ComponentDemos.tsx`
- **What changed:** Built 21 reusable core UI components following Apple-level layout rules: strict rectangular geometry with modest radii (4px/6px/8px), hairline 1px borders, solid neutral surfaces, zero glass/blur/pill/capsule shapes. Standardized all Lucide icons to `strokeWidth={1.5}` via shared `Icon` wrapper. All spring motion goes through `src/editor/motion/` (Nook mass-1 engine). Submenus are portaled to `document.body` as independent `Surf` instances with safe-triangle hover protection, independent single glide spring highlight, wheel `endBump` with deck lock, Arrow navigation, and parent push scale (0.985). Unmounted when closed. Elastic slider removed per Retry 1 review. All components hydration-safe via `useMounted()` backed by `useSyncExternalStore`.
- **What A/B must do:** Import components from `@/editor/components` across all rebuilt panels (`shell`, `panels/layers`, `panels/details`, `canvas`, `menus`).
- **Status:** in progress (wip, retry 2)

### Imported candidate packages and components (as-is) [REPLACED & REMOVED]
- **Area:** imported components / design system
- **Files:** `package.json`, `src/editor/components/imported/**`, `src/editor/components/Cursor.tsx`, `src/editor/components/ScrollFade.tsx`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** The two components with unverified licenses (`Cursor` and `Scroll Fade` from Animate UI) were replaced by our own clean-room code (`src/editor/components/Cursor.tsx` and `ScrollFade.tsx`; commit `73edaba`). The `src/editor/components/imported/` directory has been completely deleted; zero license blockers remain. Unused candidate dependencies `@animate-ui/react`, `@base-ui/react`, `@floating-ui/react`, and `radix-ui` were removed from `package.json` (commits `58ae713` and `5cf6d24`) because `@animate-ui/react` broke `npm ci` in CI.
- **What A/B must do:** None (the imported folder and unused packages are removed; import `Cursor` and `ScrollFade` from `@/editor/components`).
- **Status:** done

## 5. Tokens and styles

New tokens use the `--ll-` prefix in `src/editor/styles/tokens.css`. Legacy tokens stay with the legacy UI.

### Semantic tokens, dark theme first, and shadow alpha
- **Area:** foundations / tokens
- **Files:** `src/editor/styles/tokens.css`, `src/editor/styles/tailwind.css`, `src/app/layout.tsx`
- **What changed:** Replaced numbered neutral tokens (`--ll-neutral-*`) with 11 semantic tokens from `PALETTE.md`: `--ll-surface-backdrop`, `--ll-surface-canvas`, `--ll-surface-panel`, `--ll-surface-bar`, `--ll-surface-raised`, `--ll-border-color`, `--ll-text-primary`, `--ll-text-secondary`, `--ll-text-muted`, `--ll-control-primary-bg`, `--ll-control-primary-fg`. Dark theme is default on `:root` and `[data-theme="dark"]`; light theme applies under `[data-theme="light"]`. Shadows use stronger black alpha in dark (`rgba(0,0,0,0.5)` / `0.3`) and subtle alpha in light (`0.08` / `0.04`). Tailwind exposes `ll:bg-surface-canvas`, `ll:bg-surface-panel`, `ll:bg-surface-bar`, `ll:bg-surface-raised`, `ll:bg-surface-backdrop`, `ll:text-primary`, `ll:text-secondary`, `ll:text-muted`, `ll:bg-control-primary`, `ll:text-control-primary-fg`, `ll:border-border`. Inline script in `layout.tsx` reads `localStorage` before paint to prevent theme flash.
- **What A/B must do:** Use semantic `ll:` classes instead of numbered neutrals across all new UI components.
- **Status:** open

### Control and top bar size tokens
- **Area:** tokens
- **Files:** `src/editor/styles/tokens.css`, `src/editor/styles/globals.css`
- **What changed:** Added `--ll-size-control-sm: 28px`, `--ll-size-control-md: 32px`, and `--ll-size-topbar: 48px`. Extended base resets to `.editor-root` in `globals.css` with 0 margin/border/padding button baseline and box-sizing. Added `.ll-spinner-spin` keyframe rotation animation with `prefers-reduced-motion` override.
- **What A/B must do:** Use control size tokens in new panels.
- **Status:** open

### Tailwind, tokens, and typography
- **Area:** foundations
- **Files:** `src/editor/styles/tailwind.css`, `src/editor/styles/tokens.css`, `src/editor/styles/globals.css`, `src/app/layout.tsx`
- **What changed:** Full 8-color approved palette from `PALETTE.md` implemented: `--ll-neutral-0` (#FFFFFF), `--ll-neutral-50` (#F1F1F1), `--ll-neutral-100` (#DFDFDF), `--ll-neutral-200` (#C4C4C4), `--ll-neutral-400` (#8F8F8F), `--ll-neutral-800` (#464646), `--ll-neutral-1000` (#000000), and `--ll-border-color` (rgba(143, 143, 143, 0.5)). All `@theme inline` properties reference `var(--ll-...)` without repeating raw hex or rgba values. Non-circular mappings ensure tokens under `prefix(ll)` compile correctly. Typography explicitly bound to Geist and Geist Mono across `.ll:font-sans` and `.ll:font-mono` (scoped in `globals.css` with legacy reset). Focus ring updated to `neutral-1000` (exceeds 3:1 contrast on panels). Transitions restricted to `transform` and `opacity` only (instant hover).
- **What A/B must do:** Use `ll:` classes in new UI. The prefix and scoping can be dropped when `src/legacy-editor` is removed.
- **Status:** open

### Eight official themes and motion engine foundations
- **Area:** foundations / motion / styling
- **Files:** `src/editor/styles/tokens.css`, `src/editor/styles/tailwind.css`, `src/editor/styles/animations.css`, `src/editor/motion/**`, `src/app/layout.tsx`, `src/editor/components/ThemeToggle.tsx`
- **What changed:** Implemented eight official themes from `PALETTE.md` (Paper default, Dark, White, Warm, Lilac, Noir, Graphite, Darkroom; Plum removed) with semantic tokens (`--ll-surface-*`, `--ll-text-*`, `--ll-control-*`, `--ll-select-*`, `--ll-ship-*`, `--ll-avatar-*`, `--ll-board-*`, `--ll-placeholder`, `--ll-swatch-line`, `--ll-thumb-*`, `--ll-shadow-soft`, `--ll-accent`). Non-color tokens (30px display type scale, 4px geometric spacing grid up to 64px, modest 4/6/8px radii, 16 prototype layout sizes) and per-lane token blocks added. Nook mass-1 spring motion engine ported to TypeScript in `src/editor/motion/` with presets, cached linear() CSS easing generator, shared frame loop, FLIP, and Surf box controller. Layout default theme changed to Paper.
- **What A/B must do:** Use semantic tokens and `@/editor/motion` across rebuilt screens. Do not use raw colors or Plum.
- **Status:** done

## 6. Routes and layout

### Design system route (`/design-system`)
- **Area:** design system / routes
- **Files:** `src/app/design-system/page.tsx`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** Added `/design-system` route gated with `labsEnabled` (answers 404 in production unless `NEXT_PUBLIC_ENABLE_LABS=1`), rendering the foundations canvas and navigation panel with 94 interactive sections.
- **What A/B must do:** Keep developer routes guarded by `labsEnabled`.
- **Status:** done

### Editor shell wired to the engine (2026-11-05)
- **Area:** shell / menus / stage / panels
- **Files:** `src/editor/shell/{EditorShell,RightPanelConnected,useEditorActions,prototypeDocument}.ts(x)`, `src/editor/stage/Stage.tsx`, `src/editor/panels/{layers,details,timeline,code-view,inspectors}/**`
- **Engine pieces used:**
  - **Stores:** `useProjectStore`, `useProjectMetaStore`, `useSelectionStore`, `useCameraStore`, `useSnapStore`, `useCanvasViewStore`, `useHistoryStore`, `useDocument`, `useLayers`, `ProjectDatabase`
  - **Commands:** `invokeCommand` and the command registry (`@/core/commands` — align, distribute, tidy, layer reorder/hierarchy, undo/redo, viewport presets, zoom, fitToRect, command palette, `documentCommands.insertLayers`)
  - **Camera:** `useCameraStore` (`setViewport`, `fitToRect`, `stepZoom`, `zoomTo100`), ResizeObserver viewport reporting on Stage
  - **Snap:** `useSnapStore` (rulers, snapping guidelines, smart spacing marks)
  - **Project boot, autosave, project lock:** persistence wiring in `EditorShell.tsx` via `useProjectFiles`, `useProjectLock`, `useShellCommands`, status hook `data-testid="save-status"` on logo button, and `ReadOnlyBanner`
  - **Real-document seed:** `src/editor/shell/prototypeDocument.ts` (16 layers seeded via `documentCommands.insertLayers` on initial blank project boot; stage, layers tree, inspector, code view and timeline all read and write real document layers; demo stopgaps `PROTOTYPE_ELEMENTS`, `SAMPLE_STAGE_ELEMENTS`, `mockOverrides`, and forced initial selection removed in commit `d7df6af`)
- **What A/B must do:** nothing to the engine. Menu items with no engine command are shown disabled with a reason (Output Log, Plugins, Deployment, Logic, Data). Collaborator avatars have no presence data in the engine, so the stack is hidden.
- **Engine changes requested:** none so far.
- **Status:** done

## 7. Tests

### E2E helpers and test hooks
- **Files:** `tests/e2e/support/editor.ts`, `tests/e2e/transport-bar.spec.ts`
- **What changed:** Migrated shared test helpers to the new editor markup:
  - `focusApp`: logo button "Application menu", then Escape
  - `openFileMenu`: opens logo menu, then hovers File menuitem
  - `waitSaved`: waits for `[data-testid="save-status"][data-state="saved"]`
  - `openSequencer`: clicks Motion mode tab, waits for `[aria-label="Motion Timeline"]`
  - `exportProject`: clicks menuitem "Export project file"
  - `tests/e2e/transport-bar.spec.ts`: migrated to toolbar "Timeline header" and passes cleanly.
- **Test hooks:** Comprehensive `data-testid` and `data-*` attribute list across shell, stage, layers, timeline, and inspector. Full list and old-to-new selector map in [DOCS/UI/handoffs/e2e-testids.md](file:///E:/Projects/magnm%20related/lazy%20layout/DOCS/UI/handoffs/e2e-testids.md).
- **Status:** done

### E2E helper defaults to new editor with explicit targeting
- **Files:** `tests/e2e/support/editor.ts`, all specs in `tests/e2e/**`
- **What changed:** `tests/e2e/support/editor.ts` defaults `openEditor(page, url = EDITOR_URL)` to the NEW editor (`EDITOR_URL = "/editor"`) and exports `LEGACY_EDITOR_URL = "/editor/legacy"`. Every spec now names its target explicitly (commit `23a74aa`): 29 legacy specs from main explicitly target `LEGACY_EDITOR_URL` (138/138 pass), and new editor specs target `EDITOR_URL`.
- **Status:** done

### Timeline playback sub-frame accumulator fix
- **Files:** `src/editor/motion-model/MotionModelStore.ts`
- **What changed:** Fixed bug where timeline playback ran at ~3 fps of real speed because fractional frames were dropped on each tick. A sub-frame accumulator preserves fractional delta time so playback runs at 60 fps real speed (commit `ea8ee24`).
- **Status:** done

### Phase check results, 2026-11-05 (production build of PR #62 branch `integrate/main-into-new-ui`)
- **PR:** Opened PR #62 into `main`: https://github.com/NetPranav/LazyLayout/pull/62
- **typecheck (`npx tsc --noEmit`):** clean (0 errors).
- **build (`NEXT_PUBLIC_ENABLE_LABS=1 npm run build`):** passes cleanly; `/editor` and `/editor/legacy` present in the route list.
- **lint (`npx eslint src/editor src/app`):** 0 errors, 32 warnings. `src/legacy-editor src/core` has 1 error in old code: `src/legacy-editor/menus/UnifiedLogoMenu.tsx:99` (`setState` in an effect), untouched from main.
- **e2e (`npm run test:e2e`):** full suite on production build: **199 passed, 65 skipped (`test.fixme` with written reasons), 0 failed, 0 flaky (264 tests total across chromium)**. Group handoffs: `DOCS/UI/handoffs/*-e2e-g1..g4.md`, `*-e2e-target-audit.md`, `*-fix-8-tests.md`, `*-legacy-e2e.md`, `*-playback-fix.md`, `*-merge-main.md`.
- **Browser smoke:** `/editor`: 16 real layers, a drag changes the value and saves, reload restores, undo works, no page errors. `/editor/legacy`: loads, no page errors.

## 8. Open items before merge

Pull Request #62 into `main` is open: https://github.com/NetPranav/LazyLayout/pull/62 (branch `integrate/main-into-new-ui`; `ui/redesign` is older branch on GitHub).

Honest list of open items before merging into `main`:
1. **PR #62 review and merge:** PR #62 is open for review by the friend's Claude to merge with a merge commit (`gh pr merge 62 --merge`).
2. **New-UI screens for main's features:** Features from main's phases 39 to 81 (pen and vector tools, auto layout, breakpoints, tokens, components and variants, MCP agent, templates, scroll model, export) work only at `/editor/legacy`. They need designs from the design session (`DOCS/UI/design/REQUESTS.md`), then worker tasks to build them in `src/editor`.
3. **Old-app areas with no new version:** 17 unbuilt areas: project launcher / hub home page, database studio, blueprint (currently shell only), content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace (standalone panel), render gallery, and fonts.
4. **The 65 `test.fixme` tests:** Re-enable and migrate the 65 `test.fixme` tests as those new-UI capabilities are built. (0 failed, 0 flaky out of 264 total tests).
5. **Responsive checks:** Visual inspection and verification at 1024px (tablet) and 390px (mobile) breakpoints across all modes have not been done.
6. **Reduced motion verification:** Systematic check of `prefers-reduced-motion` compliance across all spring animations and transitions has not been performed.
7. **Six non-default themes visually:** Visual inspection of White, Warm, Lilac, Noir, Graphite, and Darkroom across screens has not been performed.
8. **Firefox `field-sizing: content` support:** `NumberField` uses CSS `field-sizing: content` which is not yet supported in Firefox; requires fallback handling or verification.
9. **Final side-by-side screenshots:** Prototype vs. app visual parity screenshots at 1440px in Paper and Dark themes across Design, Motion, and Code modes remain to be captured.
10. **Timeline header token:** Timeline header token is 44px (prototype task said 40; flagged for design session).
11. **Legacy lint error:** fixed in the merge review (2026-11-05): `src/legacy-editor/menus/UnifiedLogoMenu.tsx` reset its submenu state inside an effect (a lint error that failed CI `verify`); it now resets while rendering, the same behaviour. That file is not from `main`: it came from the `wip(ui)` experiments (feba8ec).

### W4: engine changes requested for Motion and Code (2026-11-11)
- **Area:** motion / code
- **Requests:**
  1. Console: remove the sample `INITIAL_LOGS` seed in `src/editor/panels/console/consoleStore.ts`, and make Run emit a real build result (outside W4's lane).
  2. Trace: a runtime trace source. `TraceView` uses the constant `TRACE_STEPS`.
  3. Compiler: per-layer line ranges in the emitted files, so a canvas selection can highlight code and a code line can select a layer.
  4. Compiler: framework, styling and animation options (Vue, HTML, Tailwind, CSS modules). The Code inspector selects do nothing because the emitters only produce Next.js 15 with scoped CSS.
  5. Core: clip trim, split and duplicate as single commands. W4 composes them from `updateClip`, `addClip`, `removeClip` and `setKeyframe` inside one `transaction`.
- **Status:** open

### Pen and vector (2026-11-11)
- **Area:** design / stage / right panel / layers
- **Replaced / added:** the Pen button became a flyout (Pen, Pencil, Anchor; Shift+C is new) and "Pen" left the Shape menu; `stage/DraftPath.tsx` restyled (ghost line, close ring); new `stage/pen/` (`penAdapter.ts`, `PathEditLayer.tsx`, `PathContextBar.tsx`, `AnchorMark.tsx`); new Vector section (`panels/details/sections/VectorSection.tsx`); path rows in the Layers tree (own icon, point count); token `--ll-pen-mark` in `tokens.css`. `CanvasTool` gained `"anchor"` (maps to the core `select` tool).
- **Relies on (read-only):** `useVectorEditStore`, `useDraftPathStore`, `core/paths/pathEdit` (move, insert, delete, close, toggleSmooth, hit tests), `core/paths/penModel`, `core/editing/vectorOps` (`applyPathEdit`, `editablePath`, `booleanLayers`), `createPathLayer`, `setLayerProps` (`svg.fillRule`), `deleteLayers`, `transaction`.
- **Adapter-only (in `src/editor/stage/pen/penAdapter.ts`, each is one undo step, no engine command behind it):** point type, round corners, join.
- **Engine changes requested:**
  1. **Point type on the node.** `PathNode` has no type, so Straight / Mirrored / Free are read from the handles, and "Free" on a mirrored point only shortens its incoming handle. Wanted: `PathNode.kind` (`straight | mirrored | angle | free`) saved in `svg.nodes`, and `moveHandle` honouring it instead of guessing from collinearity.
  2. **Join as an engine operation.** `joinPaths(a, b)` (and "join with this path's other end") in `vectorOps`, keeping the first layer's id, name, look and motion; today the adapter makes a new layer and deletes both, so layer ids, keys and links are lost.
  3. **Live corner radius on paths.** `svg.cornerRadius` (and per-point radius) rendered by the path builder; today the adapter rewrites the nodes once ("Round"), so the radius cannot be changed afterwards and the points stay.
  4. **Close and continue.** A close/open command and "continue this path from its end" (pen on an end point of an existing open path); `penModel` only starts new paths.
  5. **Compound paths.** `editablePath` returns null for a path with more than one subpath, so Edit points and the point tools do nothing on boolean results with holes.
  6. **Path edit mode in the engine's command table.** `path.edit`, `path.exitEdit`, `path.deleteNodes` exist only in `legacy-editor/canvas/vector/useVectorEdit.ts`; the new UI binds the keys itself (Enter, Esc, Backspace in `PathEditLayer.tsx`). Moving them to `src/core` would let both editors share them.
  7. **Anchor tool id.** `core/tools/toolDefs` has no `anchor` tool, so the Anchor button sets `select` and the UI keeps the tool name.
- **Status:** open

### Option popovers: engine-side gaps found by the 2026-11-12 proof
- **Stroke miter limit.** `svg.strokeMiterlimit` is not a property in `core/document/properties.ts` (the type exists in `core/types/svg.ts`, nothing reads or writes it). The Miter field in the Stroke row popover is disabled. Wanted: `svg.strokeMiterlimit` (number, 1 to 20, default 4, scope `SVG_STROKED`), emitted as `stroke-miterlimit`.
- **Cap, join and dash** (`svg.strokeLinecap`, `svg.strokeLinejoin`, `svg.strokeDasharray`) are legal only for icons, vector paths and the shape layers (`SVG_STROKED`). A button, frame, text or image draws its stroke as a CSS border (`appearance.border.*`), which has no cap or join; the controls are disabled with a tooltip on those layers. Wanted if buttons and frames should dash: map `appearance.border.style` dashed or dotted, nothing else.
- **Per-corner radius** (`shape.cornerRadius.topLeft` and the other three) is legal only for `rectangle`. Other layers take one `appearance.radius`; the popover now writes that for the first corner and disables the other three. Wanted: four corner radii on frames, buttons and images (`appearance.radius.topLeft` and so on, emitted as `border-top-left-radius`).
- **Status:** open
