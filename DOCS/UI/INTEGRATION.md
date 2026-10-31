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

## 3. Engine changes requested

## 4. New shared UI pieces

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

## 5. Tokens and styles

New tokens use the `--ll-` prefix in `src/editor/styles/tokens.css`. Legacy tokens stay with the legacy UI.

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

## 6. Routes and layout

### Design system route (`/design-system`)
- **Area:** design system / routes
- **Files:** `src/app/design-system/page.tsx`, `src/editor/design-system/DesignSystemPage.tsx`
- **What changed:** Added `/design-system` route gated with `labsEnabled` (answers 404 in production unless `NEXT_PUBLIC_ENABLE_LABS=1`), rendering the foundations canvas and navigation panel.
- **What A/B must do:** Keep developer routes guarded by `labsEnabled`.
- **Status:** done

## 7. Tests

### E2E File menu helper
- **Files:** `tests/e2e/support/editor.ts` (`openFileMenu`)
- **What changed:** The helper clicks a top-level "File" button. The experimental top bar now in `src/legacy-editor` has no such button, so tests using this helper are expected to fail until the new top bar is in. Keep a reachable File button or update the helper. Claude owns this.
- **Status:** open

## 8. Open items before merge
