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
- **What changed:** Main's editor is retained and served at `/editor/legacy` with all Phase 39-81 features (pen tool, auto layout, breakpoints, tokens, graph editor). Rendered `LegacyStudioHeader` in `headerSlot` to provide the classic menu bar (`File`, `Edit`, `View`, `Window`, `Help`) and `#header-toggle-demo-btn` ("Mount Showcase Demo"), and imported legacy `globals.css` for `--z-header` and `--z-dropdown` stacking context. Configured `openEditor` in `tests/e2e/support/editor.ts` to default to `LEGACY_EDITOR_URL` (`/editor/legacy`). All 29 of main's e2e spec files pass 100% (138/138 tests).
- **What A/B must do:** Target `LEGACY_EDITOR_URL` (`/editor/legacy`) for old-UI e2e tests.
- **Status:** done

### Old UI spec docs removed
- **Area:** docs
- **Files:** `DOCS/INITIAL/UI.md`, `DOCS/INITIAL/PANELS.md`
- **What changed:** Deleted on the user's instruction, because they describe the old UI. They remain in git history. Other docs and `src/ai/copilot/DiagnosticSuggester.ts` still mention them by name.
- **What A/B must do:** Do not restore them on merge.
- **Status:** open

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

## 3. Engine changes requested

None so far. The new editor reuses existing core engine stores, commands, time scheduler, and persistence infrastructure without requiring modifications to `src/core`, `src/compiler`, or `src/runtime`.

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

### Imported candidate packages and components (as-is) [REMOVED]
- **Area:** imported components / design system
- **Files:** `package.json`, `src/editor/components/imported/**`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** Previously installed candidate packages and components under `src/editor/components/imported/` have been removed. The `imported/` folder is gone.
- **What A/B must do:** None (the imported folder is removed).
- **Status:** removed

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

### Explicit URL targeting for new UI E2E specs
- **Files:** `tests/e2e/deterministic-clock.spec.ts`, `tests/e2e/transport-bar.spec.ts`, `tests/e2e/layers.spec.ts`, `tests/e2e/presets.spec.ts`
- **What changed:** `tests/e2e/support/editor.ts` defaults `openEditor(page, url = LEGACY_EDITOR_URL)` to `/editor/legacy` so legacy specs run cleanly. Specs targeting the new UI explicitly pass `openEditor(page, "/editor")`.
- **Status:** done

### Phase check results, 2026-11-05 (build session)
- **typecheck (`npx tsc --noEmit`):** pass (0 errors).
- **build (`NEXT_PUBLIC_ENABLE_LABS=1 npm run build`):** pass.
- **lint (`npm run lint`):** 0 errors in `src/editor` (about 38 warnings), 1 error in legacy read-only code `src/legacy-editor/menus/UnifiedLogoMenu.tsx` (`react-hooks/set-state-in-effect`), which is untouched from initial branch setup.
- **e2e (`npm run test:e2e`):** 77 passed, 96 `fixme`, 4 failing flaky-looking (177 total tests across chromium). Unsupported legacy features (creation drawing tools, multi-frame canvas, font file upload, asset pipeline) are marked `test.fixme` with documented reasons per spec in `DOCS/UI/handoffs/2026-11-05-*-e2e-g1..g4.md`. 4 failures appear flaky/timing-related (`deterministic-clock`, `playback-on-clock`, `snapping`, `stage-incremental`).

## 8. Open items before merge

Honest list of open items before merging `ui/redesign` to `main`:
1. **E2E `fixme` tests:** Re-enable and migrate the 96 `test.fixme` tests as new capabilities are added or real document APIs allow.
2. **Flaky tests:** Investigate and stabilize the 4 timing/flaky test failures (`tests/e2e/deterministic-clock.spec.ts`, `playback-on-clock.spec.ts`, `snapping.spec.ts`, `stage-incremental.spec.ts`).
3. **Legacy-only areas with no new version:** Decide product strategy (bridge, hide, or drop) and design/build for the 17 unbuilt areas: project launcher / hub home page, database studio, blueprint (currently shell only), content browser, copilot, deployment, global search, history, pages manager, plugins, settings, state, versioning, dependencies, execution trace (standalone panel), render gallery, and fonts.
4. **Unverified license on imported components:** `Cursor` (`src/editor/components/imported/cursor/index.ts`) and `Scroll Fade` (`src/editor/components/imported/scroll-fade/index.ts`) have unverified licenses from Animate UI. Per `UI_RULES.md` §5, unclear licenses must be replaced or confirmed before merging.
5. **Responsive checks:** Visual inspection and verification at 1024px (tablet) and 390px (mobile) breakpoints across all modes have not been done.
6. **Reduced motion verification:** Systematic check of `prefers-reduced-motion` compliance across all spring animations and transitions has not been performed.
7. **Firefox `field-sizing: content` support:** `NumberField` uses CSS `field-sizing: content` which is not yet supported in Firefox; requires fallback handling or verification.
8. **Side-by-side screenshots:** Final prototype vs. app visual parity screenshots at 1440px in Paper and Dark themes across Design, Motion, and Code modes remain to be captured and reviewed.
